cmake_minimum_required(VERSION 3.6)

project(GatrixCocos2dxSDK)

set(LIB_NAME gatrix-cocos2dx-sdk)

file(GLOB_RECURSE LIB_SRC
    "src/*.cpp"
)

file(GLOB_RECURSE LIB_HEADERS
    "include/*.h"
)

add_library(${LIB_NAME} STATIC ${LIB_SRC} ${LIB_HEADERS})

target_include_directories(${LIB_NAME} PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# Assuming cocos2d is available in the parent project
# target_link_libraries(${LIB_NAME} cocos2d)
