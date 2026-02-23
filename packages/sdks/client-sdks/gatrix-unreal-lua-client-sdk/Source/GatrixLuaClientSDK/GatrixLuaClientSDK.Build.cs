// Copyright Gatrix. All Rights Reserved.

using UnrealBuildTool;

public class GatrixLuaClientSDK : ModuleRules
{
    public GatrixLuaClientSDK(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "GatrixClientSDK",
            "LuaScriptRuntime" // Unreal Engine custom Lua runtime module (uses LuaJIT internally)
        });
    }
}
