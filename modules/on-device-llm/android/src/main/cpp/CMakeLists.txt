cmake_minimum_required(VERSION 3.22)
project(quock_llm LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)

# The engine is llama.cpp at a pinned build, fetched at configure time; QUOCK_LLAMA_DIR points at a local checkout
# instead (offline work, or testing a newer build before pinning it).
set(QUOCK_LLAMA_TAG "b12617" CACHE STRING "llama.cpp release tag")

# One shared library per CPU feature level, chosen when the app starts: the same APK runs on a phone with i8mm and on
# one without, each at the speed its CPU allows.
set(BUILD_SHARED_LIBS ON CACHE BOOL "" FORCE)
set(GGML_BACKEND_DL ON CACHE BOOL "" FORCE)
set(GGML_CPU_ALL_VARIANTS ON CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_LLAMAFILE OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_COMMON ON CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(LLAMA_CURL OFF CACHE BOOL "" FORCE)
set(LLAMA_OPENSSL OFF CACHE BOOL "" FORCE)
set(LLAMA_SUBPROCESS OFF CACHE BOOL "" FORCE)

if(DEFINED QUOCK_LLAMA_DIR AND EXISTS "${QUOCK_LLAMA_DIR}")
  add_subdirectory(${QUOCK_LLAMA_DIR} llama)
  set(LLAMA_SRC ${QUOCK_LLAMA_DIR})
else()
  include(FetchContent)
  FetchContent_Declare(llama_cpp
    GIT_REPOSITORY https://github.com/ggml-org/llama.cpp.git
    GIT_TAG ${QUOCK_LLAMA_TAG}
    GIT_SHALLOW TRUE)
  FetchContent_MakeAvailable(llama_cpp)
  set(LLAMA_SRC ${llama_cpp_SOURCE_DIR})
endif()

add_library(quock_llm SHARED engine.cpp jni.cpp)
target_include_directories(quock_llm PRIVATE ${LLAMA_SRC}/common ${LLAMA_SRC}/include ${LLAMA_SRC}/ggml/include
  ${LLAMA_SRC}/vendor)
target_compile_options(quock_llm PRIVATE -Wno-deprecated-declarations)
target_link_libraries(quock_llm PRIVATE llama llama-common android log)
