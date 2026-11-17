// Load splash: the nest mark zooms in from big and soft to sharp, the wordmark follows, then the
// whole layer fades away (~2.9 s). Server component, pure HTML + CSS, so it paints with the first
// HTML, before hydration. Once per tab session; off for reduced motion.
// The inline <script> carries the request's CSP nonce (scripts need it under 'strict-dynamic');
// inline styles are already allowed. The privacy policy names the session-storage marker.

const SEEN_KEY = "nidos-splash-seen"

// Runs while the HTML parses, before the splash paints. Hides it with an injected <style>:
// React 19 skips unexpected tags in <head>, so this causes no hydration mismatch.
// On the first visit the same style goes in once the splash has faded out, so a client-side
// re-render of the layout (switching LV/EN) cannot mount and play it a second time.
const onceScript = `try{var hide=function(){var s=document.createElement("style");s.textContent=".nidos-splash{display:none!important}";document.head.appendChild(s)};if(window.parent!==window||sessionStorage.getItem("${SEEN_KEY}")){hide()}else{sessionStorage.setItem("${SEEN_KEY}","1");document.addEventListener("animationend",function h(e){if(e.animationName==="nidos-out"){hide();document.removeEventListener("animationend",h)}})}}catch(e){}`

const css = `
.nidos-splash{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow:hidden;background:var(--color-paper-2,#eeedea);color:var(--color-ink,#292728);pointer-events:none;animation:nidos-out .45s ease 2.4s forwards}
.nidos-splash__stage{position:relative;width:120px;height:120px}
.nidos-splash__mark{display:block;animation:nidos-zoom 1.7s cubic-bezier(.25,.6,.2,1) both}
.nidos-splash__word{position:absolute;left:-200px;right:-200px;top:150px;text-align:center;font-size:36px;font-weight:600;letter-spacing:-.025em;line-height:1;animation:nidos-word .45s cubic-bezier(.2,.7,.2,1) 1.5s both}
.nidos-splash__line{fill:none;stroke:var(--color-ink,#292728);stroke-width:10;stroke-linecap:round}
.nidos-splash__dot{fill:var(--color-peach,#facdb8)}
@keyframes nidos-zoom{0%{opacity:0;transform:scale(2.4);filter:blur(8px)}15%{opacity:1}45%{filter:blur(0)}100%{opacity:1;transform:scale(1);filter:blur(0)}}
@keyframes nidos-word{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes nidos-out{to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){.nidos-splash{display:none}}
`

export function NidosSplash({ nonce }: { nonce?: string }) {
  return (
    <>
      {/* The browser hides a nonce from the DOM after parsing, so hydration sees it as empty. */}
      <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: onceScript }} />
      <style nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: css }} />
      <div className="nidos-splash" aria-hidden="true">
        <div className="nidos-splash__stage">
          <svg className="nidos-splash__mark" width="120" height="120" viewBox="0 0 120 120">
            <path className="nidos-splash__line" d="M16.77 44.27 A46 46 0 1 1 24.76 89.57" />
            <path className="nidos-splash__line" d="M82.98 40.72 A30 30 0 1 1 54.79 30.46" />
            <circle className="nidos-splash__dot" cx="60" cy="60" r="9" />
          </svg>
          <span className="nidos-splash__word">Project Nidos</span>
        </div>
      </div>
    </>
  )
}
