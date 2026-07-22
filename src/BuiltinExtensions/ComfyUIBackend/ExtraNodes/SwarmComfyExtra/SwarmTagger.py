import torch
import torch.nn as nn
import numpy as np
from PIL import Image
import json
import os
import folder_paths

TAGGER_FOLDER = "pixai_tagger"
_model_cache = {}


class TaggingHead(nn.Module):
    def __init__(self, input_dim, num_classes):
        super().__init__()
        self.linear = nn.Linear(input_dim, num_classes)

    def forward(self, x):
        return self.linear(x)


def get_tagger_dir():
    if TAGGER_FOLDER in folder_paths.folder_names_and_paths:
        return folder_paths.folder_names_and_paths[TAGGER_FOLDER][0][0]
    return os.path.join(folder_paths.models_dir, TAGGER_FOLDER)


def load_tagger_model(device):
    tagger_dir = get_tagger_dir()
    model_path = os.path.join(tagger_dir, "model_v0.9.pth")
    tags_path = os.path.join(tagger_dir, "tags_v0.9_13k.json")
    char_ip_path = os.path.join(tagger_dir, "char_ip_map.json")
    for path, name in [(model_path, "model_v0.9.pth"), (tags_path, "tags_v0.9_13k.json"), (char_ip_path, "char_ip_map.json")]:
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"[SwarmTagger] Missing '{name}' in '{tagger_dir}'. "
                f"Download it from https://huggingface.co/pixai-labs/pixai-tagger-v0.9 (gated, requires accepting license) "
                f"and place it in your Models/{TAGGER_FOLDER}/ folder."
            )
    cache_key = str(device)
    if cache_key in _model_cache:
        return _model_cache[cache_key]
    import timm
    encoder = timm.create_model("hf_hub:SmilingWolf/wd-eva02-large-tagger-v3", pretrained=False, num_classes=0)
    encoder.reset_classifier(0)
    decoder = TaggingHead(1024, 13461)
    model = nn.Sequential(encoder, decoder)
    state = torch.load(model_path, map_location=device, weights_only=False)
    model.load_state_dict(state)
    model = model.to(device).eval()
    with open(tags_path, "r", encoding="utf-8") as f:
        tags_data = json.load(f)
    tag_map = tags_data["tag_map"]
    gen_tag_count = tags_data["tag_split"]["gen_tag_count"]
    char_ip_map = {}
    if os.path.exists(char_ip_path):
        with open(char_ip_path, "r", encoding="utf-8") as f:
            char_ip_map = json.load(f)
    idx_to_tag = {v: k for k, v in tag_map.items()}
    result = {
        "model": model,
        "idx_to_tag": idx_to_tag,
        "gen_tag_count": gen_tag_count,
        "char_ip_map": char_ip_map,
    }
    _model_cache[cache_key] = result
    return result


def pil_to_rgb(img):
    if img.mode == "RGBA":
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[3])
        return background
    return img.convert("RGB")


class SwarmImageTagger:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE",),
                "general_threshold": ("FLOAT", {"default": 0.30, "min": 0.01, "max": 1.0, "step": 0.01, "tooltip": "Confidence threshold for general/feature tags."}),
                "character_threshold": ("FLOAT", {"default": 0.75, "min": 0.01, "max": 1.0, "step": 0.01, "tooltip": "Confidence threshold for character tags."}),
            }
        }

    CATEGORY = "SwarmUI/tagging"
    RETURN_TYPES = ("STRING", "STRING", "STRING")
    RETURN_NAMES = ("feature_tags", "character_tags", "ip_tags")
    FUNCTION = "tag_image"
    DESCRIPTION = "Tag an anime image using the PixAI Tagger v0.9 (WD EVA02-large). Requires model files in Models/pixai_tagger/. See https://huggingface.co/pixai-labs/pixai-tagger-v0.9"
    OUTPUT_NODE = True

    def tag_image(self, image, general_threshold, character_threshold):
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        loaded = load_tagger_model(device)
        model = loaded["model"]
        idx_to_tag = loaded["idx_to_tag"]
        gen_tag_count = loaded["gen_tag_count"]
        char_ip_map = loaded["char_ip_map"]
        img_np = np.clip(255.0 * image[0].cpu().numpy(), 0, 255).astype(np.uint8)
        pil_img = pil_to_rgb(Image.fromarray(img_np))
        from torchvision import transforms
        transform = transforms.Compose([
            transforms.Resize((448, 448)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
        ])
        tensor = transform(pil_img).unsqueeze(0).to(device)
        with torch.inference_mode():
            logits = model(tensor)
            probs = torch.sigmoid(logits).squeeze(0).cpu().numpy()
        feature_tags = []
        character_tags = []
        ip_tags_set = set()
        for idx in range(len(probs)):
            tag = idx_to_tag.get(idx)
            if tag is None:
                continue
            score = float(probs[idx])
            if idx < gen_tag_count:
                if score >= general_threshold:
                    feature_tags.append(tag)
            else:
                if score >= character_threshold:
                    character_tags.append(tag)
                    ips = char_ip_map.get(tag, [])
                    for ip in ips:
                        ip_tags_set.add(ip)
        ip_tags = sorted(ip_tags_set)
        return (", ".join(feature_tags), ", ".join(character_tags), ", ".join(ip_tags))


NODE_CLASS_MAPPINGS = {
    "SwarmImageTagger": SwarmImageTagger,
}
