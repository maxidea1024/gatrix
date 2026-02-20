// Copyright Gatrix. All Rights Reserved.

using UnrealBuildTool;

public class GatrixLuaSDK : ModuleRules
{
    public GatrixLuaSDK(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "GatrixSDK",
            "LuaScriptRuntime" // Unreal Engine custom Lua runtime module (uses LuaJIT internally)
        });
    }
}
