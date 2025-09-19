# Memoji Caching System

## Overview
The memoji caching system reduces OpenAI API costs by storing generated memojis and serving cached results for similar prompt configurations.

## Architecture

### Database Schema
- **Table**: `memoji_cache`
- **Key**: `prompt_hash` (SHA-256 of normalized configuration)
- **Storage**: Supabase Storage bucket `memoji-images`

### Cache Flow
1. **Request**: User generates memoji with specific configuration
2. **Hash**: Generate SHA-256 hash of normalized configuration
3. **Check**: Look up hash in `memoji_cache` table
4. **Hit**: Return cached image URL (no credits consumed)
5. **Miss**: Generate via OpenAI, store in cache, return result

### Configuration Normalization
```javascript
const normalized = {
  model: config.model || 'gpt-image-1',
  size: config.size || '1024x1024',
  familyType: config.familyType || 'father',
  gesture: config.gesture || 'wave',
  hair: (config.hair || 'short').toLowerCase(),
  skinTone: (config.skinTone || 'medium').toLowerCase(),
  accessories: (config.accessories || []).sort(),
  colorTheme: config.colorTheme || 'pastel-blue',
  background: config.background || 'auto'
};
```

## API Endpoints

### `/api/cache/stats`
- **Method**: GET
- **Purpose**: Monitor cache effectiveness
- **Returns**: Cache statistics, cost savings, efficiency metrics

### `/api/cache/cleanup`
- **Method**: POST
- **Purpose**: Maintain cache health
- **Actions**: 
  - Delete entries older than 90 days with <2 uses
  - Archive entries with >100 uses

## Expected Benefits

### Cost Savings
- **60-80% reduction** in OpenAI API costs
- **$0.02 saved** per cache hit
- **Instant response** for duplicate prompts

### Performance
- **Cache hit ratio**: Expected 40-60%
- **Response time**: <100ms for cached results
- **Storage cost**: Minimal (~50KB per image)

## Monitoring

### Key Metrics
- Total cached memojis
- Total cache usage count
- Average usage per cached memoji
- Estimated cost savings
- Cache efficiency percentage

### Usage Tracking
- `usage_count`: Times this cached memoji was served
- `last_used_at`: Last time this memoji was requested
- `generation_cost`: Cost saved per cache hit

## Maintenance

### Automatic Cleanup
- Run `/api/cache/cleanup` daily via cron job
- Remove old entries (90+ days, <2 uses)
- Archive popular entries (100+ uses)

### Storage Management
- Images organized by date: `YYYY/MM/hash.png`
- 5MB file size limit per image
- Public access for cached images

## Implementation Details

### Files
- `api/cache/utils.js` - Core caching functions
- `api/cache/stats.js` - Statistics endpoint
- `api/cache/cleanup.js` - Maintenance endpoint
- `migrations/004_create_memoji_cache.sql` - Database schema

### Integration
- Modified `api/generate-memoji/index.js` to check cache before OpenAI
- Cache check happens before credit enforcement
- Cached results don't consume user credits

## Future Enhancements

### Phase 2
- Cache warming for popular configurations
- User-specific cache preferences
- A/B testing for cache strategies

### Phase 3
- Intelligent cache preloading
- Machine learning for cache optimization
- Advanced analytics and reporting
