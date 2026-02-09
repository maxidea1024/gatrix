// Copyright Gatrix. All Rights Reserved.

using UnrealBuildTool;

public class GatrixSDK : ModuleRules
{
    public GatrixSDK(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "HTTP",
            "Json",
            "JsonUtilities"
        });
    }
}
