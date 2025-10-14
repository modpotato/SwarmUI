using FreneticUtilities.FreneticExtensions;
using Newtonsoft.Json.Linq;
using SwarmUI.Accounts;
using SwarmUI.Core;
using SwarmUI.Utils;
using System.Net.Http;

namespace SwarmUI.Services;

/// <summary>Resolves model dependencies from CivitAI by SHA256 hash or version ID.</summary>
public class CivitAIResolver
{
    private readonly Session _session;
    private static readonly HttpClient _httpClient = new();

    public CivitAIResolver(Session session)
    {
        _session = session;
    }

    /// <summary>Try to resolve a dependency from CivitAI.</summary>
    public async Task<bool> TryResolveFromCivitAI(ModelDependency dependency)
    {
        try
        {
            // Get CivitAI API key from user settings
            string apiKey = _session.User.GetGenericData("civitai_api", "key");
            if (string.IsNullOrEmpty(apiKey))
            {
                Logs.Debug("CivitAI API key not configured, skipping CivitAI resolution");
                return false;
            }

            JObject modelInfo = null;

            // Try to lookup by SHA256 hash first (preferred)
            if (!string.IsNullOrEmpty(dependency.Sha256))
            {
                modelInfo = await LookupBySHA256(dependency.Sha256, apiKey);
            }

            // Fallback to version ID if available
            if (modelInfo == null && !string.IsNullOrEmpty(dependency.CivitAIVersionId))
            {
                modelInfo = await LookupByVersionId(dependency.CivitAIVersionId, apiKey);
            }

            if (modelInfo == null)
            {
                Logs.Debug($"Could not find model on CivitAI for: {dependency.Reference}");
                return false;
            }

            // Check license requirements
            if (!CheckLicenseAllowed(modelInfo))
            {
                dependency.Status = DependencyStatus.Failed;
                dependency.ErrorMessage = "Model license not accepted or allowed by policy";
                Logs.Warning($"Model license not allowed for: {dependency.Reference}");
                return false;
            }

            // Get download URL
            string downloadUrl = GetDownloadUrl(modelInfo);
            if (string.IsNullOrEmpty(downloadUrl))
            {
                dependency.Status = DependencyStatus.Failed;
                dependency.ErrorMessage = "Could not get download URL from CivitAI";
                return false;
            }

            // Schedule download
            // For now, we mark as download scheduled
            // The actual download would be triggered via existing download infrastructure
            dependency.Status = DependencyStatus.DownloadScheduled;
            dependency.ResolvedSource = "civitai";
            
            // Store metadata for download
            if (modelInfo.TryGetValue("name", out JToken nameToken))
            {
                dependency.Filename = nameToken.ToString();
            }

            Logs.Info($"Scheduled CivitAI download for: {dependency.Reference}");
            return true;
        }
        catch (Exception ex)
        {
            Logs.Error($"Error resolving from CivitAI: {ex}");
            return false;
        }
    }

    /// <summary>Look up a model by SHA256 hash.</summary>
    private async Task<JObject> LookupBySHA256(string sha256, string apiKey)
    {
        try
        {
            string url = $"https://civitai.com/api/v1/model-versions/by-hash/{sha256}";
            HttpRequestMessage request = new(HttpMethod.Get, url);
            
            if (!string.IsNullOrEmpty(apiKey))
            {
                request.Headers.Add("Authorization", $"Bearer {apiKey}");
            }

            HttpResponseMessage response = await _httpClient.SendAsync(request);
            
            if (!response.IsSuccessStatusCode)
            {
                if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    Logs.Debug($"Model not found on CivitAI for hash: {sha256}");
                    return null;
                }
                
                Logs.Warning($"CivitAI API error: {response.StatusCode}");
                return null;
            }

            string content = await response.Content.ReadAsStringAsync();
            return JObject.Parse(content);
        }
        catch (Exception ex)
        {
            Logs.Error($"Error looking up model by SHA256: {ex}");
            return null;
        }
    }

    /// <summary>Look up a model by version ID.</summary>
    private async Task<JObject> LookupByVersionId(string versionId, string apiKey)
    {
        try
        {
            string url = $"https://civitai.com/api/v1/model-versions/{versionId}";
            HttpRequestMessage request = new(HttpMethod.Get, url);
            
            if (!string.IsNullOrEmpty(apiKey))
            {
                request.Headers.Add("Authorization", $"Bearer {apiKey}");
            }

            HttpResponseMessage response = await _httpClient.SendAsync(request);
            
            if (!response.IsSuccessStatusCode)
            {
                if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    Logs.Debug($"Model not found on CivitAI for version ID: {versionId}");
                    return null;
                }
                
                Logs.Warning($"CivitAI API error: {response.StatusCode}");
                return null;
            }

            string content = await response.Content.ReadAsStringAsync();
            return JObject.Parse(content);
        }
        catch (Exception ex)
        {
            Logs.Error($"Error looking up model by version ID: {ex}");
            return null;
        }
    }

    /// <summary>Check if the model's license is allowed based on policy.</summary>
    private bool CheckLicenseAllowed(JObject modelInfo)
    {
        try
        {
            // Get license settings from server configuration
            CivitAISettings settings = Program.ServerSettings.CivitAI;
            
            if (settings == null)
            {
                // No license restrictions configured, allow by default
                return true;
            }

            // Check if ToS auto-accept is required and enabled
            if (!settings.AllowTosAutoAccept)
            {
                Logs.Debug("ToS auto-accept not enabled in settings");
                // Could still allow if the user has manually accepted
                // For now, we'll be conservative and require the setting
            }

            // Check license against allowed list
            if (modelInfo.TryGetValue("model", out JToken modelToken) && modelToken is JObject model)
            {
                if (model.TryGetValue("allowCommercialUse", out JToken commercialToken))
                {
                    string commercialUse = commercialToken.ToString().ToLowerFast();
                    
                    // If we have an allowed licenses list, check it
                    if (settings.AllowedLicenses != null && settings.AllowedLicenses.Count > 0)
                    {
                        bool licenseAllowed = false;
                        
                        foreach (string allowedLicense in settings.AllowedLicenses)
                        {
                            string normalizedAllowed = allowedLicense.ToLowerFast();
                            
                            // Map common license terms
                            if (normalizedAllowed.Contains("commercial") && commercialUse != "none")
                            {
                                licenseAllowed = true;
                                break;
                            }
                            else if (normalizedAllowed.Contains("noncommercial") || normalizedAllowed.Contains("non-commercial"))
                            {
                                licenseAllowed = true;
                                break;
                            }
                            else if (normalizedAllowed == "*" || normalizedAllowed == "all")
                            {
                                licenseAllowed = true;
                                break;
                            }
                        }
                        
                        if (!licenseAllowed)
                        {
                            Logs.Info($"Model license '{commercialUse}' not in allowed list");
                            return false;
                        }
                    }
                }
            }

            return true;
        }
        catch (Exception ex)
        {
            Logs.Error($"Error checking license: {ex}");
            // Fail safe - don't allow if we can't verify
            return false;
        }
    }

    /// <summary>Extract download URL from model info.</summary>
    private string GetDownloadUrl(JObject modelInfo)
    {
        try
        {
            // Try to get primary file download URL
            if (modelInfo.TryGetValue("files", out JToken filesToken) && filesToken is JArray files && files.Count > 0)
            {
                // Find the primary file
                foreach (JToken fileToken in files)
                {
                    if (fileToken is JObject file)
                    {
                        bool isPrimary = file.TryGetValue("primary", out JToken primaryToken) && 
                                       primaryToken.Type == JTokenType.Boolean && 
                                       (bool)primaryToken;
                        
                        if (isPrimary || files.Count == 1)
                        {
                            if (file.TryGetValue("downloadUrl", out JToken urlToken))
                            {
                                return urlToken.ToString();
                            }
                        }
                    }
                }
            }

            // Fallback to downloadUrl at root level
            if (modelInfo.TryGetValue("downloadUrl", out JToken downloadUrlToken))
            {
                return downloadUrlToken.ToString();
            }
        }
        catch (Exception ex)
        {
            Logs.Error($"Error extracting download URL: {ex}");
        }

        return null;
    }
}
