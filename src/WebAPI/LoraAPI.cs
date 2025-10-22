using Newtonsoft.Json.Linq;
using SwarmUI.Core;
using SwarmUI.Text2Image;
using SwarmUI.Accounts;
using SwarmUI.Utils;

namespace SwarmUI.WebAPI;

[API.APIClass("API routes for LoRA metadata exposure.")]
public static class LoraAPI
{
    public static void Register()
    {
        API.RegisterAPICall(GetLoraMetadata, false, Permissions.FundamentalGenerateTabAccess);
    }

    [API.APIDescription("Return a list of installed LoRAs with metadata for UI consumption.",
        """
        {
            "loras": [
                {
                    "id": "lora-name",
                    "title": "Display Title",
                    "author": "Author Name",
                    "triggerPhrase": "xxx667_illu, glowing",
                    "description": "Short description or usage hint",
                    "preview": "data:image/.. or /View/..",
                    "tags": ["tag1","tag2"]
                }
            ]
        }
        """)]
    public static Task<JObject> GetLoraMetadata(Session session)
    {
        try
        {
            var handler = Program.T2IModelSets.GetValueOrDefault("LoRA");
            if (handler is null)
            {
                return Task.FromResult(new JObject() { ["loras"] = new JArray() });
            }

            JArray arr = new();
            foreach (T2IModel model in handler.ListModelsFor(session))
            {
                var meta = model.Metadata;
                JObject obj = new();
                obj["id"] = model.Name;
                obj["title"] = meta?.Title ?? model.Name;
                obj["author"] = meta?.Author;
                obj["triggerPhrase"] = meta?.TriggerPhrase;
                obj["description"] = meta?.Description ?? meta?.UsageHint;
                obj["preview"] = meta?.PreviewImage;
                if (meta?.Tags is not null)
                {
                    obj["tags"] = JArray.FromObject(meta.Tags);
                }
                obj["width"] = meta?.StandardWidth ?? 0;
                obj["height"] = meta?.StandardHeight ?? 0;
                obj["mergedFrom"] = meta?.MergedFrom;
                obj["license"] = meta?.License;
                // usageCount isn't tracked centrally yet; set 0 for now
                obj["usageCount"] = 0;

                arr.Add(obj);
            }

            return Task.FromResult(new JObject() { ["loras"] = arr });
        }
        catch (Exception ex)
        {
            Logs.Error($"Error retrieving LoRA metadata: {ex}");
            return Task.FromResult(new JObject() { ["error"] = ex.Message });
        }
    }
}
