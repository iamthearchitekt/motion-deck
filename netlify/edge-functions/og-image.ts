import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  
  // URL format expected: /deck/:slug
  if (pathParts.length < 3 || pathParts[1] !== 'deck') {
    return context.next();
  }
  
  const slug = pathParts[2];
  if (!slug) {
    return context.next();
  }

  // Edge Functions access env vars via Deno.env or Netlify.env
  const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL") || Netlify.env.get("VITE_SUPABASE_URL");
  const supabaseKey = Deno.env.get("VITE_SUPABASE_ANON_KEY") || Netlify.env.get("VITE_SUPABASE_ANON_KEY");

  let imageUrl = null;

  if (supabaseUrl && supabaseKey) {
    try {
      // 1. Fetch deck by slug to get deck ID
      const deckRes = await fetch(`${supabaseUrl}/rest/v1/decks?slug=eq.${slug}&select=id`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      const decks = await deckRes.json();
      
      if (decks && decks.length > 0) {
        const deckId = decks[0].id;
        
        // 2. Fetch first page of deck to get imageUrl
        const pagesRes = await fetch(`${supabaseUrl}/rest/v1/pages?deckId=eq.${deckId}&order=order.asc&limit=1&select=imageUrl,imageDataUrl`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        });
        const pages = await pagesRes.json();
        
        if (pages && pages.length > 0) {
          // Prefer imageUrl over imageDataUrl as data URIs don't work for OG tags
          imageUrl = pages[0].imageUrl || pages[0].imageDataUrl;
        }
      }
    } catch (e) {
      console.error("Error fetching from Supabase in edge function:", e);
    }
  }

  // Get the original response (the index.html)
  const response = await context.next();
  
  if (!imageUrl || imageUrl.startsWith('data:')) {
    return response;
  }

  // Only rewrite HTML responses
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("text/html")) {
    return response;
  }

  const text = await response.text();
  
  // Replace the default og:image tags with the specific deck's image
  const modifiedText = text
    .replace(/<meta property="og:image" content="[^"]*" \/>/g, `<meta property="og:image" content="${imageUrl}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*" \/>/g, `<meta name="twitter:image" content="${imageUrl}" />`);

  return new Response(modifiedText, {
    status: response.status,
    headers: response.headers,
  });
};
