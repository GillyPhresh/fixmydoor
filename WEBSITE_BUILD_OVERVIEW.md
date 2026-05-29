# FixMyDoor Services Website Build Overview

This website was built as a full-stack web application for FixMyDoor Services, a door, furniture, installation, repair, and hardware sourcing business based in Montreal, Canada.

## Main Purpose

The website is designed to help customers:

- Understand FixMyDoor Services quickly.
- View door, furniture, hardware, repair, and installation services.
- Send repair or product requests with photos and details.
- Read service information, FAQs, reviews, and trust-building content.
- Use the website in English and French.
- Install the website as a home screen app.
- Receive service, review, advert, and website update notifications.

## Frontend

The frontend is built with:

- React for the website interface.
- TypeScript for safer code and fewer future errors.
- Vite for fast local development and optimized production builds.
- Tailwind CSS for responsive styling.
- shadcn/ui and Radix UI components for forms, dialogs, cards, tabs, buttons, and accessible controls.
- Lucide React icons for buttons and interface icons.
- Framer Motion and CSS transitions for light animations.
- Embla carousel support and custom mobile carousel behavior for image galleries.

The homepage includes:

- Sticky responsive header.
- Call Now button.
- English/French language switcher.
- Mobile menu.
- Service sections.
- Door buying gallery.
- Recent work/gallery sections.
- Floating advert system.
- Lightbox preview with zoom support.
- FAQ and trust sections.
- Contact/booking form.
- Review display and review submission.
- PWA install and refresh behavior.

## Backend

The backend is built with:

- Node.js.
- Express.
- TypeScript.
- Prisma ORM.
- Database-backed bookings, reviews, sessions, admin users, content, and tracking records.
- Express session authentication for the admin dashboard.
- Secure password hashing with bcrypt.
- Nodemailer/email service integration for customer/admin booking emails.
- Server-side upload handling for images, videos, and documents.
- Push notification subscription storage and notification delivery.

The backend provides API routes for:

- Customer bookings.
- Booking tracking.
- Admin login/logout/status.
- Admin dashboard stats.
- Admin booking management.
- Content management.
- Review moderation.
- Media uploads.
- Push notifications.
- Sitemap and robots.txt.
- SEO page rendering.

## Admin Dashboard

The admin dashboard is available at `/admin`.

It allows the owner to:

- View booking requests.
- Update customer request status.
- Manage website content.
- Upload media.
- Approve or manage reviews.
- Send push notifications.
- Install the admin dashboard as its own app.
- Enable admin alerts for new customer requests.
- Check email and notification status.

The admin dashboard is protected by:

- Password login.
- Server-side session storage.
- HTTP-only secure cookies in production.
- Login rate limiting.
- Upload rate limiting.
- Admin-only API guards.
- `noindex, nofollow` metadata so Google does not index private admin pages.

## SEO Setup

The website includes technical SEO support such as:

- Unique page titles and descriptions.
- Canonical URLs.
- Sitemap at `/sitemap.xml`.
- Robots file at `/robots.txt`.
- Google Search Console verification meta tag.
- Local business structured data.
- Service structured data.
- FAQ structured data.
- Breadcrumb structured data.
- Open Graph and Twitter preview metadata.
- Geo/location metadata for Montreal, Quebec, Canada.
- Real service photo social preview image.
- Redirect handling for old service URLs.
- Trailing slash redirects to reduce duplicate URL indexing.

Important Google Search Console note:

Warnings like "Page with redirect" and "Alternative page with proper canonical tag" can be normal when Google finds old URLs, redirected aliases, trailing slash URLs, query URLs, or alternate language URLs. The important thing is that the clean canonical URLs are submitted in the sitemap and indexed.

## PWA / App Setup

The website is set up as a Progressive Web App.

This means visitors can install it on phones and laptops without the App Store or Google Play.

PWA features include:

- `manifest.json` for the main website app.
- `admin-manifest.json` for the admin app.
- Separate main website and admin app icons.
- Service worker caching.
- Home screen install support.
- Offline fallback.
- Faster repeat visits.
- Automatic service worker updates.
- In-app refresh button for the installed homepage app.

The app icons were generated from the 3D FixMyDoor logo image and saved in multiple sizes for mobile and desktop devices.

## Notifications

The notification system supports:

- Visitor notifications.
- Admin notifications.
- New advert notifications.
- New review notifications.
- Website update notifications.
- New customer request alerts for the admin dashboard.

Visitors must allow notifications first. After permission is granted, the browser/device controls whether alerts appear as phone or desktop pop-ups.

## Translation

The site uses a free static translation approach instead of paid Google Translate or DeepL API calls.

This avoids:

- API bills.
- Exposed API keys.
- Live API failures.
- Domain whitelist problems.

## Security Measures

The website includes:

- Helmet security headers.
- Disabled `X-Powered-By`.
- Secure admin sessions.
- HTTP-only cookies.
- HTTPS-ready cookies in production.
- Login rate limiting.
- General API rate limiting.
- Upload rate limiting.
- File type validation.
- Upload size limits.
- Hidden server/source paths in production.
- Admin pages blocked from indexing.
- Protected admin-only API routes.
- Form validation on client and server.
- Safer cache behavior for the installed apps.

No public website can be guaranteed to run forever without hosting, domain, DNS, payment, or server issues, but the code has been structured to reduce avoidable failures, slowdowns, stale app cache issues, and common admin security risks.

## Performance Measures

Performance work includes:

- Vite optimized frontend build.
- Compressed server responses.
- Lazy-loaded images where appropriate.
- Responsive image layouts.
- Lighter mobile section layouts.
- Service worker caching for repeat visits.
- Network-first page loading so installed apps can refresh.
- Static assets cached for speed.
- API responses protected from unnecessary caching where live data matters.

## Hosting And Deployment

The project is designed to run on a Node-capable host such as Railway.

Typical deployment flow:

1. Commit the code to GitHub.
2. Deploy the connected repository to Railway.
3. Set production environment variables.
4. Confirm `https://www.fixmydoor.ca` points to the live Railway app.
5. Submit `https://www.fixmydoor.ca/sitemap.xml` in Google Search Console.
6. Validate indexing fixes in Google Search Console after deployment.

## What To Tell Someone Who Asks How It Was Made

You can say:

"FixMyDoor Services was built as a modern full-stack React and Node.js website. The frontend uses React, TypeScript, Vite, Tailwind CSS, Radix/shadcn UI components, and responsive mobile-first design. The backend uses Node.js, Express, Prisma, secure sessions, admin authentication, uploads, bookings, reviews, email support, push notifications, sitemap generation, and SEO structured data. The website is also a Progressive Web App, so customers can install it like an app on phones and laptops without using the App Store or Google Play."

