<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class LinkPreviewController extends Controller
{
    public function preview(Request $request)
    {
        $request->validate(['url' => 'required|url']);

        $url = $request->url;

        try {
            $response = Http::timeout(5)
                ->withHeaders(['User-Agent' => 'Mozilla/5.0 (compatible; NoteApp/1.0)'])
                ->get($url);

            if (!$response->successful()) {
                return response()->json([
                    'url'     => $url,
                    'title'   => null,
                    'description' => null,
                    'image'   => null,
                    'favicon' => null,
                ]);
            }

            $html = $response->body();
            $title       = $this->extractMeta($html, 'og:title')       ?: $this->extractTitle($html);
            $description = $this->extractMeta($html, 'og:description') ?: $this->extractMeta($html, 'description');
            
            // Try multiple image sources: og:image > twitter:image > og:video:image
            $image = $this->extractMeta($html, 'og:image')
                  ?: $this->extractMeta($html, 'twitter:image')
                  ?: $this->extractMeta($html, 'og:video:image');
            
            $favicon     = $this->extractFavicon($html, $url);

            // Resolve relative image URLs
            if ($image && !str_starts_with($image, 'http')) {
                $image = $this->resolveUrl($url, $image);
            }
            if ($favicon && !str_starts_with($favicon, 'http')) {
                $favicon = $this->resolveUrl($url, $favicon);
            }

            return response()->json([
                'url'         => $url,
                'title'       => $title,
                'description' => $description,
                'image'       => $image,
                'favicon'     => $favicon,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'url'     => $url,
                'title'   => null,
                'description' => null,
                'image'   => null,
                'favicon' => null,
            ]);
        }
    }

    private function extractMeta(string $html, string $property): ?string
    {
        $patterns = [
            '/<meta\s+[^>]*?(?:property|name)=["\']' . preg_quote($property, '/') . '["\']\s+content=["\']([^"\']*)["\'][^>]*?\/?>/i',
            '/<meta\s+[^>]*?content=["\']([^"\']*)["\'][^>]*?(?:property|name)=["\']' . preg_quote($property, '/') . '["\'][^>]*?\/?>/i',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $html, $m)) {
                return html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5);
            }
        }

        return null;
    }

    private function extractTitle(string $html): ?string
    {
        if (preg_match('/<title>([^<]*)<\/title>/i', $html, $m)) {
            return html_entity_decode(trim($m[1]), ENT_QUOTES | ENT_HTML5);
        }
        return null;
    }

    private function extractFavicon(string $html, string $pageUrl): ?string
    {
        if (preg_match('/<link[^>]*?rel=["\'](?:shortcut )?icon["\'][^>]*?href=["\']([^"\']*)["\'][^>]*?\/?>/i', $html, $m)) {
            return $m[1];
        }
        // Fallback: /favicon.ico
        return rtrim($pageUrl, '/') . '/favicon.ico';
    }

    private function resolveUrl(string $base, string $relative): string
    {
        $parts = parse_url($base);
        $scheme = $parts['scheme'] ?? 'https';
        $host   = $parts['host'] ?? '';

        if (str_starts_with($relative, '//')) {
            return $scheme . ':' . $relative;
        }
        if (str_starts_with($relative, '/')) {
            return $scheme . '://' . $host . $relative;
        }
        // Relative path
        $basePath = dirname($parts['path'] ?? '/');
        return $scheme . '://' . $host . $basePath . '/' . $relative;
    }
}
