import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MedPlant Payments Backend</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: #f4f7f6;
                color: #333;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                text-align: center;
            }
            .container {
                background: white;
                padding: 2rem;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                max-width: 500px;
            }
            h1 {
                color: #2e7d32;
                margin-bottom: 1rem;
            }
            p {
                line-height: 1.6;
                color: #666;
            }
            .status {
                display: inline-block;
                background-color: #e8f5e9;
                color: #2e7d32;
                padding: 0.25rem 0.75rem;
                border-radius: 100px;
                font-weight: bold;
                margin-bottom: 2rem;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="status">LIVE</div>
            <h1>MedPlant Payments Backend is Live</h1>
            <p>This server handles secure subscription payments for the MedPlant mobile application.</p>
        </div>
    </body>
    </html>
  `);
}
