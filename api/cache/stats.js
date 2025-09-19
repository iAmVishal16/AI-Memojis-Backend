import { getCacheStats } from './utils.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }
  
  try {
    const stats = await getCacheStats();
    
    if (!stats) {
      return res.status(500).json({ error: { message: 'Failed to retrieve cache statistics' } });
    }
    
    // Calculate additional metrics
    const avgUsagePerCached = stats.totalCached > 0 ? (stats.totalUsage / stats.totalCached).toFixed(2) : 0;
    const estimatedCostSavings = (stats.totalUsage - stats.totalCached) * 0.02; // $0.02 per generation saved
    
    return res.status(200).json({
      success: true,
      stats: {
        ...stats,
        avgUsagePerCached: parseFloat(avgUsagePerCached),
        estimatedCostSavings: parseFloat(estimatedCostSavings.toFixed(4)),
        cacheEfficiency: stats.totalCached > 0 ? `${((stats.totalUsage / (stats.totalUsage + stats.totalCached)) * 100).toFixed(1)}%` : '0%'
      }
    });
    
  } catch (error) {
    console.error('Error retrieving cache stats:', error);
    return res.status(500).json({ error: { message: 'Internal server error' } });
  }
}
