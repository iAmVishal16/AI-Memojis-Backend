export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  try {
    const { userId, rating, reviewComment } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ error: { message: 'userId is required' } });
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ error: { message: 'rating must be a number between 1 and 5' } });
    }

    // For now, just return success without database operations to test deployment
    return res.status(200).json({
      success: true,
      message: 'Feedback received successfully',
      data: { userId, rating, reviewComment }
    });

  } catch (error) {
    console.error('Unexpected error in feedback submission:', error);
    return res.status(500).json({ error: { message: 'Internal server error' } });
  }
}
