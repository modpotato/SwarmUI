using FreneticUtilities.FreneticExtensions;
using SwarmUI.Accounts;
using SwarmUI.Core;
using SwarmUI.Text2Image;
using SwarmUI.Utils;

namespace SwarmUI.Services;

/// <summary>Resolves model dependencies by checking local catalog, remote nodes, and CivitAI.</summary>
public class ModelDependencyResolver
{
    private readonly Session _session;
    private readonly CivitAIResolver _civitaiResolver;

    public ModelDependencyResolver(Session session)
    {
        _session = session;
        _civitaiResolver = new CivitAIResolver(session);
    }

    /// <summary>Resolve a single model dependency.</summary>
    public async Task ResolveDependency(ModelDependency dependency)
    {
        Logs.Debug($"Resolving dependency: {dependency.Type} - {dependency.Reference}");

        // Step 1: Check local catalog
        if (TryResolveLocally(dependency))
        {
            Logs.Info($"Dependency resolved locally: {dependency.Reference}");
            return;
        }

        // Step 2: Check remote SwarmUI nodes (if configured)
        if (await TryResolveFromRemoteNodes(dependency))
        {
            Logs.Info($"Dependency resolved from remote node: {dependency.Reference}");
            return;
        }

        // Step 3: Try CivitAI
        if (await _civitaiResolver.TryResolveFromCivitAI(dependency))
        {
            Logs.Info($"Dependency resolved from CivitAI: {dependency.Reference}");
            return;
        }

        // Failed to resolve
        dependency.Status = DependencyStatus.Failed;
        dependency.ErrorMessage = "Could not resolve dependency from any source";
        Logs.Warning($"Failed to resolve dependency: {dependency.Reference}");
    }

    /// <summary>Try to resolve a dependency from the local model catalog.</summary>
    private bool TryResolveLocally(ModelDependency dependency)
    {
        try
        {
            // Map dependency type to model handler
            T2IModelHandler handler = GetHandlerForType(dependency.Type);
            if (handler == null)
            {
                Logs.Debug($"No handler found for type: {dependency.Type}");
                return false;
            }

            // Try to find by SHA256 hash
            if (!string.IsNullOrEmpty(dependency.Sha256))
            {
                foreach (var model in handler.Models.Values)
                {
                    if (model.Metadata?.Hash != null && 
                        model.Metadata.Hash.Equals(dependency.Sha256, StringComparison.OrdinalIgnoreCase))
                    {
                        dependency.Status = DependencyStatus.Resolved;
                        dependency.ResolvedPath = model.RawFilePath;
                        dependency.ResolvedSource = "local";
                        return true;
                    }
                }
            }

            // Try to find by filename or model key
            if (!string.IsNullOrEmpty(dependency.Filename))
            {
                string searchKey = dependency.Filename;
                
                // Try exact match
                if (handler.Models.TryGetValue(searchKey, out T2IModel model))
                {
                    dependency.Status = DependencyStatus.Resolved;
                    dependency.ResolvedPath = model.RawFilePath;
                    dependency.ResolvedSource = "local";
                    return true;
                }

                // Try with .safetensors extension
                if (!searchKey.EndsWith(".safetensors") && 
                    handler.Models.TryGetValue(searchKey + ".safetensors", out model))
                {
                    dependency.Status = DependencyStatus.Resolved;
                    dependency.ResolvedPath = model.RawFilePath;
                    dependency.ResolvedSource = "local";
                    return true;
                }

                // Try partial match (case-insensitive)
                var partialMatch = handler.Models.Values.FirstOrDefault(m => 
                    m.Name.Contains(searchKey, StringComparison.OrdinalIgnoreCase));
                
                if (partialMatch != null)
                {
                    dependency.Status = DependencyStatus.Resolved;
                    dependency.ResolvedPath = partialMatch.RawFilePath;
                    dependency.ResolvedSource = "local";
                    Logs.Info($"Resolved '{searchKey}' to '{partialMatch.Name}' via partial match");
                    return true;
                }
            }
        }
        catch (Exception ex)
        {
            Logs.Error($"Error resolving dependency locally: {ex}");
        }

        return false;
    }

    /// <summary>Try to resolve from remote SwarmUI nodes.</summary>
    private async Task<bool> TryResolveFromRemoteNodes(ModelDependency dependency)
    {
        // TODO: Implement remote node resolution using the manifest API
        // This will be implemented when remote node communication is set up
        // For now, return false
        await Task.CompletedTask;
        return false;
    }

    /// <summary>Get the appropriate model handler for a dependency type.</summary>
    private T2IModelHandler GetHandlerForType(string type)
    {
        string normalizedType = type.ToLowerFast();

        return normalizedType switch
        {
            "checkpoint" or "model" => Program.T2IModelSets.GetValueOrDefault("Stable-Diffusion"),
            "lora" => Program.T2IModelSets.GetValueOrDefault("LoRA"),
            "vae" => Program.T2IModelSets.GetValueOrDefault("VAE"),
            "embedding" or "textualinversion" => Program.T2IModelSets.GetValueOrDefault("Embedding"),
            "controlnet" => Program.T2IModelSets.GetValueOrDefault("ControlNet"),
            _ => null
        };
    }
}
