# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

- **Build**: `bun run build` - Uses tsup to compile TypeScript to ESM with declaration files and source maps
- **Format**: `bun run format` - Format code with Biome
- **Format check**: `bun run format:check` - Check code formatting without making changes
- **Test**: `bun test` - Run all tests using Bun's built-in test runner
- **Test with snapshots**: `BUN_UPDATE_SNAPSHOTS=1 bun test -u` - Update SVG snapshots
- **Single test**: `bun test tests/scene1.test.ts` - Run specific test file

## Architecture

This is a zero-dependency 3D SVG renderer built in TypeScript. The core architecture consists of:

### Single Entry Point (`lib/index.ts`)

- All functionality is contained in one ~400 line file
- Exports the main `renderScene` function and type definitions
- Uses pure mathematical calculations for 3D to 2D projection

### Core Components

1. **3D Math**: Vector operations (add, sub, cross, dot, normalize) and rotation transforms
2. **Camera System**: View matrix calculation and perspective projection with configurable focal length
3. **Box Rendering**: Generates 8 vertices per box, applies rotations, projects to screen space
4. **Face Culling**: Back-face culling using surface normals to only render visible faces
5. **Depth Sorting**: Z-buffer sorting to render faces in correct depth order
6. **Text Rendering**: Affine transforms to align labels with 3D face orientation
7. **Image Mapping**: Perspective-correct texture mapping using two triangulated images per face

### Visual Snapshot Testing

Tests use `bun-match-svg` for SVG snapshot testing. Each test generates an SVG and compares against stored snapshots in `tests/__snapshots__/`. This enables visual regression testing for 3D positioning and rendering.

### Key Constraints

- SVG only supports affine transforms, not perspective transforms, so text on 3D faces appears slightly "off"
- Images on top faces use dual-triangle mapping to approximate perspective correction
- All colors support both string format (`"red"`) and RGBA tuple format (`[255, 0, 0, 1]`)
