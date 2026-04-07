// Copyright Gatrix. All Rights Reserved.

using UnrealBuildTool;
using System.IO;

public class GatrixClientSDK : ModuleRules
{
    public GatrixClientSDK(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;
        bEnableExceptions = true; // Required for ThirdParty decoders (std::vector)

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "HTTP",
            "Json",
            "JsonUtilities",
            "WebSockets",
            // Banner system dependencies
            "UMG",
            "Slate",
            "SlateCore",
            "Media",
            "MediaUtils",
            "MediaAssets",
            "ImageWrapper",
            "RHI",
            "RenderCore",
            "InputCore"
        });

        // ThirdParty: GIF/WebP decoders
        string ThirdPartyPath = Path.Combine(ModuleDirectory, "ThirdParty");
        PublicIncludePaths.Add(ThirdPartyPath);

        // libwebp integration (optional — binary lives in game project's ThirdParty/)
        // The SDK plugin itself only contains header-only decoders.
        // libwebp binaries are placed by the game project at: <ProjectDir>/ThirdParty/libwebp/
        string ProjectThirdParty = Path.Combine(Path.GetDirectoryName(Target.ProjectFile.FullName), "ThirdParty");
        string LibWebPInclude = Path.Combine(ProjectThirdParty, "libwebp", "include");
        if (Directory.Exists(LibWebPInclude))
        {
            PublicIncludePaths.Add(LibWebPInclude);
            PublicDefinitions.Add("GATRIX_HAS_LIBWEBP=1");

            string LibDir = "";
            if (Target.Platform == UnrealTargetPlatform.Win64)
            {
                LibDir = Path.Combine(ProjectThirdParty, "libwebp", "lib", "Win64");
            }
            else if (Target.Platform == UnrealTargetPlatform.IOS)
            {
                LibDir = Path.Combine(ProjectThirdParty, "libwebp", "lib", "iOS");
            }

            if (!string.IsNullOrEmpty(LibDir) && Directory.Exists(LibDir))
            {
                if (Target.Platform == UnrealTargetPlatform.Win64)
                {
                    PublicAdditionalLibraries.Add(Path.Combine(LibDir, "webp.lib"));
                    PublicAdditionalLibraries.Add(Path.Combine(LibDir, "libwebpdemux.lib"));
                }
                else if (Target.Platform == UnrealTargetPlatform.IOS)
                {
                    PublicAdditionalLibraries.Add(Path.Combine(LibDir, "libwebp.a"));
                    PublicAdditionalLibraries.Add(Path.Combine(LibDir, "libwebpdemux.a"));
                }
            }
        }
    }
}
