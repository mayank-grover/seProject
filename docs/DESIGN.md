# Stillspace mobile design

Adapted from the user-supplied `liquid-glass-design` skill. Its SwiftUI, UIKit and WidgetKit APIs are Apple-specific; this Android implementation translates the visual and interaction principles into a bundled web interface inside a native Android shell.

## Principles extracted and applied

| Skill guidance                                        | Stillspace implementation                                                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Reserve glass for navigation and interactive controls | One floating bottom navigation container and a grouped date/duration control; readable room cards use steady surfaces.            |
| Group sibling glass to limit compositing              | Navigation shares a single blur layer. No stack of individually blurred room cards.                                               |
| Use tint to signal prominence                         | Restrained sage accents, neutral text and a contrasting primary action.                                                           |
| Capsules, circles and rounded rectangles              | Circular utility buttons, a rounded bottom bar and consistent 12/16/22/30px corner sizes.                                         |
| Interactive effects belong on interactive elements    | Small press feedback on buttons; static cards remain still.                                                                       |
| Animate related state transitions                     | The shared navigation indicator glides between tabs; sheets enter with a short eased transition.                                  |
| Consider scroll edges and content beneath bars        | Content scrolls behind floating navigation with sufficient bottom clearance; native system-bar and keyboard insets are respected. |
| Test appearance and contrast                          | Light, dark and system themes; reduced-transparency option; reduced-motion support; 44px controls and visible keyboard focus.     |
| Avoid glass everywhere or deep glass nesting          | One primary glass navigation layer; one grouped contextual toolbar; sheets and dense schedules remain visually quiet.             |

The native Apple glass APIs, WidgetKit accent rendering, exact material refraction and `glassEffectID` morphing are not available in Android WebView and are not claimed here. Shared CSS blur and a moving selection surface provide a restrained approximation.

## Information architecture

- **Explore:** current or simulated time, duration, search/type filters, schedule status, room cards.
- **Week:** a room selector, branch display filter and five teaching-day tabs; full event text with source links.
- **Saved:** room references kept on this device.
- **Data:** import counts, original scans, unmapped entries, exports and coverage limitations.

Date/time testing, room details, source scans and appearance open in bottom sheets. Native Android Back closes the top sheet, then returns to Explore, then leaves the app.

## Visual tokens

Light backgrounds use `#F4F5F0`, surfaces `#FCFCF8`, ink `#25382B` and accent `#456B4E`. Dark mode uses `#161C18`, `#202821`, `#E6ECDF` and `#AFCEA3`. Typography uses the installed system font, including Android Roboto, without network requests.

Use 24px page gutters, 12px card gaps, 44px minimum controls, 11–13px supporting text and 27px room titles. Status always includes text. “CSE schedule gap” describes only the supplied partial timetable, never actual occupancy or room eligibility.

## Android implementation references

The Android shell follows [Android's local content guidance](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content), serving bundled resources through a secure synthetic origin with `WebViewAssetLoader`. The build uses the documented [AGP 8.13 compatibility requirements](https://developer.android.com/build/releases/agp-8-13-0-release-notes): Gradle 8.13 and JDK 17.
