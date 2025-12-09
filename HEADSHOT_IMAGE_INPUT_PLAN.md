# Plan: Add Headshot Image Input to gpt-image-1 Generation

## Research Findings from OpenAI Documentation

Based on the official OpenAI documentation at:
https://platform.openai.com/docs/guides/image-generation?image-generation-model=gpt-image-1&api=image

### Key Findings:

1. **Input Images ARE Supported:**
   - Documentation states: "Given a prompt and/or an input image, the model will generate a new image"
   - gpt-image-1 supports input images for reference

2. **Input Fidelity Parameter:**
   - `input_fidelity` parameter can be set to `"high"` to preserve details from input images
   - Default is `"low"`
   - High fidelity preserves richer textures and finer details from the first input image

3. **Multiple Input Images:**
   - Can provide multiple input images
   - First image is preserved with richer textures and finer details
   - All images preserved with high fidelity when `input_fidelity: "high"`

4. **Input Image Formats:**
   - Base64 encoded strings
   - File IDs (for Response API)
   - Data URL format: `data:image/jpeg;base64,{base64_string}`

## Implementation Plan

### Option 1: Use `input_images` Parameter (Most Likely)

Based on documentation patterns, the parameter is likely:
```javascript
generationParams.input_images = [req.body.headshot]; // Array of base64 strings
generationParams.input_fidelity = "high"; // Preserve details from headshot
```

### Option 2: Use `image` Parameter (Alternative)

Some sources suggest:
```javascript
generationParams.image = req.body.headshot; // Single base64 string
generationParams.input_fidelity = "high";
```

### Option 3: Use `images.edit` Endpoint

If `images.generate` doesn't support it, we might need:
```javascript
// Use images.edit instead of images.generate
const image = await openai.images.edit({
  image: req.body.headshot, // Base64 image
  prompt: prompt,
  n: 1,
  size: size || "1024x1024",
  input_fidelity: "high"
});
```

## Recommended Implementation

### Step 1: Try `input_images` Array Parameter
```javascript
if (selectedModel === "gpt-image-1" && req.body.headshot) {
  generationParams.size = size || "1024x1024";
  generationParams.quality = "high";
  generationParams.background = background || "auto";
  generationParams.output_format = "png";
  
  // Add headshot as input image with high fidelity
  generationParams.input_images = [req.body.headshot]; // Array of base64 strings
  generationParams.input_fidelity = "high"; // Preserve details from headshot
  console.log('Including headshot as input image with high fidelity');
}
```

### Step 2: If That Fails, Try `image` Parameter
```javascript
if (selectedModel === "gpt-image-1" && req.body.headshot) {
  // ... other params ...
  generationParams.image = req.body.headshot; // Single base64 string
  generationParams.input_fidelity = "high";
}
```

### Step 3: If Both Fail, Use Enhanced Prompt Only
Fall back to current implementation with detailed prompt analysis.

## Testing Strategy

1. **Test with `input_images` array:**
   - Deploy with `input_images: [headshot]`
   - Test end-to-end
   - Check for API errors

2. **If error, try `image` parameter:**
   - Update to `image: headshot`
   - Test again

3. **Compare Results:**
   - With input image vs without
   - Measure expression matching accuracy
   - Check if results improve

## Expected Benefits

With input image + high fidelity:
- ✅ Direct visual reference for the model
- ✅ Better preservation of facial features
- ✅ More accurate expression matching
- ✅ Richer texture and finer detail preservation

## Next Steps

1. Implement `input_images` parameter approach
2. Add `input_fidelity: "high"`
3. Deploy and test
4. Compare results with enhanced prompt only
5. Iterate based on results

