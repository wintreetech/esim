# Original travel imagery

The local files in `public/images` are original AI-generated illustrative travel photographs created using the built-in image-generation tool. They are editorial representations, not verified photographs of exact locations or network coverage. No competitor imagery was used.

Hero: `public/images/hero-coast.webp` (source PNG retained as `hero-coast.png` during generation; optimized final WebP is used by the app).

Hero prompt:

> Use case: photorealistic-natural. Asset type: original travel eSIM website hero photograph. Create one premium editorial travel photograph of an idyllic tropical coast in southern Thailand, tall limestone karst cliffs covered in rich tropical greenery rising from luminous turquoise water, small traditional wooden longtail boat in the lower center, white sand cove on the left. Natural warm morning light, rich but realistic aquamarine and emerald colors, beautiful aerial oblique landscape framing with enough top room for a tall arched crop. No text, no logos, no watermarks, no collage, no graphic borders. Landscape image 3:2, high photographic quality. This is a project asset for an original brand called Roamly, not an imitation of any competitor.

Destination prompt template:

> Use case: photorealistic-natural. Create a single high-quality original editorial travel photograph for a destination card on Roamly, an original travel eSIM website. Scene: [scene below]. Landscape 3:2 composition, realistic beautiful natural travel photography, premium magazine quality, tasteful natural color, inviting depth, no people close-ups, no text, no logos, no watermarks, no borders, no collage.

| File                 | Scene                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `uae.webp`           | Dubai, United Arab Emirates: graceful downtown skyline with Burj Khalifa across calm water, warm sunset and soft lavender sky                |
| `japan.webp`         | Kyoto, Japan: traditional wooden pagoda rising above old city roofs, cherry blossom branches and distant misty hills in warm morning light   |
| `vietnam.webp`       | Vietnam: Ha Long Bay limestone karst islands rising from emerald water, small traditional boat and lush green vegetation, soft morning light |
| `indonesia.webp`     | Bali, Indonesia: lush terraced rice fields with tropical palms and traditional Balinese stone temple details, golden morning sunlight        |
| `malaysia.webp`      | Kuala Lumpur, Malaysia: Petronas twin towers among a lush urban park with palms, beautiful blue sky and warm late afternoon light            |
| `singapore.webp`     | Singapore: Marina Bay waterfront with the recognizable three-tower rooftop landmark, green garden trees, calm water, warm blue hour          |
| `united-states.webp` | New York City, United States: Manhattan skyline across the East River with a classic bridge and warm sunlit buildings, blue sky              |
| `turkey.webp`        | Cappadocia, Turkey: graceful colorful hot air balloons over dramatic fairy-chimney rock formations in warm peach sunrise light               |
| `europe.webp`        | Paris, France: Eiffel Tower above charming cream Parisian buildings and the Seine, leafy trees and romantic warm late-afternoon light        |

The Thailand card uses the original hero coast visual. WebP encoding preserves the generated composition and avoids runtime requests to a third-party photo host.
