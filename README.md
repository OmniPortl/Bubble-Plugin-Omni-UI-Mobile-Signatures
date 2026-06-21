# Omni UI | Signatures Mobile & Web

Signature pad elements for Bubble web and Bubble native mobile apps.

The native mobile element captures signatures as SVG. When saved, it uploads an `.svg` file to Bubble and publishes the uploaded file URL as the element value. The web element uses `signature_pad` and saves PNG or JPEG files.

## Elements

### Mobile Signature Pad

Use this element in Bubble native mobile screens. It renders a touch signature area with optional Clear, Undo, and Save buttons.

Mobile output is SVG only:

- `Value` is the uploaded Bubble image/file URL after save.
- `Signature Data URL` is a `data:image/svg+xml;base64,...` string for the current signature.
- Saved files use the configured file name prefix plus a timestamp and `.svg`.

Initial signatures are displayed as an image layer inside the SVG. New strokes are drawn on top. Undo removes only user-drawn strokes, not the initial signature image.

### Web Signature Pad

Use this element in Bubble web pages. It renders a canvas-based signature pad and can save PNG or JPEG files.

## Recommended Setup

For native mobile, use either of these save patterns:

- Automatic save: set `Commit Behavior` to `on_stroke_end`.
- Manual save: set `Commit Behavior` to `manual`, then use the Save toolbar button or the `Save signature` workflow action.

Use the `Signature Saved` event to continue workflows after Bubble returns the uploaded file URL.

## Parameters

### Shared Parameters

These parameters exist on both the mobile and web elements unless noted otherwise.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| Initial Signature | image | empty | Optional Bubble image, image URL, SVG data URL, or image data URL used as the starting signature. On mobile, this is displayed as an image layer and new strokes are drawn on top. |
| Enabled | yes/no | yes | Allows or blocks drawing and toolbar interaction. The element remains visible when disabled. |
| Commit Behavior | dropdown | `on_stroke_end` | `on_stroke_end` uploads after each completed stroke. `manual` waits for the Save button or `Save signature` action. |
| Commit Delay Milliseconds | number | `500` | Delay before automatic save runs after a stroke ends. Only used when Commit Behavior is `on_stroke_end`. |
| File Name Prefix | text | `signature` | Prefix for uploaded file names. The plugin appends a timestamp and extension. |
| Pen Color | color | `#111827` | Color used for new strokes. |
| Minimum Stroke Width | number | `0.5` | Lower stroke-width value. On mobile, this is used with Maximum Stroke Width to calculate the SVG stroke width. |
| Maximum Stroke Width | number | `2.5` | Upper stroke-width value. On mobile, this is used with Minimum Stroke Width to calculate the SVG stroke width. |
| Background Color | color | `#ffffff` | Background color behind the signature. On mobile, this is also written into the SVG background rectangle. |
| Minimum Point Distance | number | `5` | Minimum movement distance before another point is recorded. Higher values create simpler signatures with fewer points. |
| Throttle Milliseconds | number | `16` | Minimum time between recorded move points. Lower values capture more detail; higher values reduce path size. |
| Placeholder Text | text | `Sign here` | Text shown while the pad is empty. |
| Show Toolbar | yes/no | yes | Shows or hides the toolbar area. |
| Show Clear Button | yes/no | yes | Shows or hides the Clear button. |
| Show Undo Button | yes/no | yes | Shows or hides the Undo button. |
| Show Save Button | yes/no | yes | Shows or hides the Save button. The workflow action can still save when hidden. |
| Clear Button Label | text | `Clear` | Text displayed in the Clear button. |
| Undo Button Label | text | `Undo` | Text displayed in the Undo button. |
| Save Button Label | text | `Save` | Text displayed in the Save button. |
| Toolbar Background Color | color | `#f8fafc` | Background color of the toolbar area. |
| Button Background Color | color | `#ffffff` | Background color for toolbar buttons. |
| Button Text Color | color | `#111827` | Text color for toolbar buttons. |
| Button Border Color | color | `#cbd5e1` | Border color for toolbar buttons. |

### Mobile Output

The mobile element has no output format selector. It saves SVG files only.

### Web-Only Output Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| Output Format | dropdown | `png` | Raster output format for the web element. Options are `png` and `jpeg`. |
| JPEG Quality | number | `0.92` | JPEG quality from `0` to `1`. Only used when Output Format is `jpeg`. |

## Exposed States

| State | Type | Description |
| --- | --- | --- |
| Value | image | Uploaded Bubble file URL after a successful save. On mobile this is the uploaded SVG file URL. |
| Signature Data URL | text | Current signature data URL. On mobile this is SVG. On web this is PNG or JPEG. |
| Is Empty | yes/no | Yes when there is no initial signature and no drawn stroke. |
| Is Drawing | yes/no | Yes while the user is actively drawing a stroke. |
| Is Uploading | yes/no | Yes while the signature is being uploaded to Bubble. |
| Stroke Count | number | Number of user-drawn strokes. On mobile, an initial signature image is not counted as a stroke. |
| Last Error | text | Most recent runtime error message, or blank after a successful operation. |

## Events

| Event | Description |
| --- | --- |
| Signature Started | Triggered when the user starts drawing a stroke. |
| Signature Changed | Triggered after the signature changes. |
| Signature Ended | Triggered when the user finishes a stroke. |
| Signature Saved | Triggered after the signature uploads successfully and `Value` is published. |
| Signature Cleared | Triggered after the signature is cleared. |
| Signature Error | Triggered when the plugin cannot initialize, export, upload, or save the signature. Check `Last Error`. |

## Actions

| Action | Description |
| --- | --- |
| Save signature | Uploads the current signature and publishes the uploaded URL to `Value`. |
| Clear signature | Clears the signature, resets states, and clears autobinding. |
| Undo last stroke | Removes the most recent user-drawn stroke. |
| Set enabled | Enables or disables drawing and toolbar interaction at runtime. |

## Notes

- In manual commit mode, use `Signature Data URL` if you need the current unsaved signature before upload.
- In automatic commit mode, avoid running save workflows on every `Signature Changed` event. Use `Signature Saved` for post-save workflows.
- Mobile SVG output is intentionally preserved as SVG so the native element stays lightweight and works in Bubble native mobile runtime.
