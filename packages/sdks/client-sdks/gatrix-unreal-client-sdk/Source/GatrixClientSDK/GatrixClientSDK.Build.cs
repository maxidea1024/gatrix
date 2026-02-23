// Copyright Gatrix. All Rights Reserved.

using UnrealBuildTool;

public class GatrixClientSDK : ModuleRules
{
    public GatrixClientSDK(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "HTTP",
            "Json",
            "JsonUtilities",
            "WebSockets"
        });
    }
}
