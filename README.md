# Neural Commander Website

Marketing website for [Neural Commander](https://neuralcommander.ai) - Liberation Technology for AI-Assisted Development.

## Tech Stack

- **Framework**: [Astro](https://astro.build/) 5.x
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) 4.x
- **Deployment**: [Vercel](https://vercel.com/)
- **Email**: [SendGrid](https://sendgrid.com/)

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
nc-website/
├── api/                    # Vercel serverless functions
│   └── waitlist.ts         # Waitlist/Foundation 100 signup
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable components
│   ├── layouts/            # Page layouts
│   ├── pages/              # Routes
│   │   ├── about/          # About pages
│   │   ├── docs/           # Documentation
│   │   ├── features/       # Feature pages
│   │   ├── investors/      # Investor portal
│   │   ├── waitlist.astro  # Waitlist signup
│   │   └── ...
│   └── styles/             # Global styles
├── vercel.json             # Vercel config
└── package.json
```

## Environment Variables

Required for production:

```env
SENDGRID_API_KEY=your_sendgrid_api_key
```

## Deployment

This site auto-deploys to Vercel on push to `main`.

- **Production**: [neuralcommander.ai](https://neuralcommander.ai)
- **Preview**: Auto-generated for PRs

## Related Repositories

| Repository | Description |
|------------|-------------|
| [neural-commander](https://github.com/angelsintheai/neural-commander) | MIT Community Edition CLI |
| nc-commercial (private) | Commercial tier features |
| nc-desktop (private) | Desktop application |

## License

MIT License - see [LICENSE](LICENSE)

---

© 2025 Neural Commander Pty Ltd • IP held by Artilect Ventures Pty Ltd
