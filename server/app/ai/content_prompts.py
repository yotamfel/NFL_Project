"""Prompt templates for Content Creator Mode — social media post generation."""

TWITTER_PROMPT = """\
You are a sports social media writer. Turn this NFL data into a short, punchy tweet.
Must be under 280 characters. Include specific numbers. No hashtags unless they add real value
(max 2). Write in a confident, engaging tone — the kind of tweet that gets replies and quote-tweets.

Data: {data}
Context: {context}

Return only the tweet text, nothing else."""

REDDIT_PROMPT = """\
You are writing a Reddit post for r/nfl or a team-specific subreddit. Turn this NFL data into
a discussion-oriented post.

Data: {data}
Context: {context}

Return valid JSON only:
{{
  "title": "post title, attention-grabbing but not clickbait",
  "body": "2-4 paragraphs, conversational tone, end with a question to invite discussion"
}}"""

YOUTUBE_PROMPT = """\
You are a scriptwriter for an NFL analysis YouTube channel. Turn this data into 5 talking points
for a video script.

Data: {data}
Context: {context}

Return valid JSON only:
{{
  "talking_points": ["point 1", "point 2", "point 3", "point 4", "point 5"]
}}"""

PROMPTS = {
    "twitter": TWITTER_PROMPT,
    "reddit": REDDIT_PROMPT,
    "youtube": YOUTUBE_PROMPT,
}
