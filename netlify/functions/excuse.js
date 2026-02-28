exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: { message: 'API ključ nije postavljen na serveru.' } }) };
  }

  try {
    const body = JSON.parse(event.body);

    // Izvuci meta podatke i ukloni ih iz tijela prije slanja Anthropicu
    const { meta, ...anthropicBody } = body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(anthropicBody)
    });

    const data = await response.json();

    // Spremi u Supabase (ako su kredencijali postavljeni)
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && data.content?.[0]?.text) {
      const { situacija, ton, vrsta, odnos } = meta || {};
      fetch(`${process.env.SUPABASE_URL}/rest/v1/upiti`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          situacija: situacija || null,
          ton: ton || null,
          vrsta: vrsta || null,
          odnos: odnos || null,
          izlika: data.content[0].text.trim()
        })
      }).catch(() => {}); // Ne blokiraj odgovor ako Supabase zakaže
    }

    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: err.message } })
    };
  }
};
