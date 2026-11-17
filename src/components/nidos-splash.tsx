// Load splash: a glass tile forms around the nest mark, lets go of it, leaves the logo and
// wordmark, then the whole layer fades away (~3.5 s). Server component, pure HTML + CSS, so it
// paints with the first HTML, before hydration. Once per tab session; off for reduced motion.
// The inline <script> carries the request's CSP nonce (scripts need it under 'strict-dynamic');
// inline styles are already allowed. The privacy policy names the session-storage marker.

const SEEN_KEY = "nidos-splash-seen"

// Runs while the HTML parses, before the splash paints. Hides it with an injected <style>:
// React 19 skips unexpected tags in <head>, so this causes no hydration mismatch.
// On the first visit the same style goes in once the splash has faded out, so a client-side
// re-render of the layout (switching LV/EN) cannot mount and play it a second time.
const onceScript = `try{var hide=function(){var s=document.createElement("style");s.textContent=".nidos-splash{display:none!important}";document.head.appendChild(s)};if(sessionStorage.getItem("${SEEN_KEY}")){hide()}else{sessionStorage.setItem("${SEEN_KEY}","1");document.addEventListener("animationend",function h(e){if(e.animationName==="nidos-out"){hide();document.removeEventListener("animationend",h)}})}}catch(e){}`

const css = `
.nidos-splash{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow:hidden;background:var(--color-paper-2,#eeedea);color:var(--color-ink,#292728);pointer-events:none;animation:nidos-out .45s ease 3s forwards}
.nidos-splash__stage{position:relative;width:240px;height:240px}
.nidos-splash__grow,.nidos-splash__tile,.nidos-splash__clip,.nidos-splash__rim{position:absolute;inset:0}
.nidos-splash__grow{animation:nidos-grow .75s cubic-bezier(.3,.7,.2,1) both}
.nidos-splash__tile{animation:nidos-release .4s ease-in 2.3s forwards}
.nidos-splash__clip,.nidos-splash__rim{border-radius:30%;animation:nidos-shape .6s ease-out .25s both}
.nidos-splash__clip{overflow:hidden}
.nidos-splash__rim{background:rgba(255,255,255,.2);box-shadow:inset 0 0 0 1px rgba(255,255,255,.95),inset 0 2px 1px #fff,inset 12px 12px 24px -14px rgba(170,184,223,.9),inset -12px -12px 24px -14px rgba(250,205,184,.95),inset 0 -16px 30px -20px rgba(41,39,40,.2),0 0 0 1px rgba(41,39,40,.07),0 20px 44px -18px rgba(41,39,40,.25)}
.nidos-splash__zoom,.nidos-splash__bare{position:absolute;left:60px;top:60px}
.nidos-splash__zoom{animation:nidos-zoom 2.2s cubic-bezier(.25,.6,.2,1) both}
.nidos-splash__sheen{position:absolute;top:-50%;left:0;width:40%;height:200%;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.65),rgba(255,255,255,0));animation:nidos-sheen 1.5s ease-in-out .8s both}
.nidos-splash__bare{animation:nidos-fade .3s ease 2.35s both}
.nidos-splash__word{position:absolute;left:-200px;right:-200px;top:210px;text-align:center;font-size:36px;font-weight:600;letter-spacing:-.025em;line-height:1;animation:nidos-word .45s cubic-bezier(.2,.7,.2,1) 2.55s both}
.nidos-splash__line{fill:none;stroke:var(--color-ink,#292728);stroke-width:10;stroke-linecap:round}
.nidos-splash__dot{fill:var(--color-peach,#facdb8)}
@keyframes nidos-grow{0%{opacity:0;transform:scale(.2)}12%{opacity:1}70%{transform:scale(1.03)}100%{opacity:1;transform:scale(1)}}
@keyframes nidos-shape{from{border-radius:50%}to{border-radius:30%}}
@keyframes nidos-zoom{0%{transform:scale(2.4);filter:blur(8px)}30%{filter:blur(0)}100%{transform:scale(1);filter:blur(0)}}
@keyframes nidos-sheen{from{transform:translateX(-160%) rotate(20deg)}to{transform:translateX(320%) rotate(20deg)}}
@keyframes nidos-release{to{opacity:0;transform:scale(1.12)}}
@keyframes nidos-fade{from{opacity:0}to{opacity:1}}
@keyframes nidos-word{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes nidos-out{to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){.nidos-splash{display:none}}
`

function NestMark({ className }: { className: string }) {
  return (
    <svg className={className} width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
      <path className="nidos-splash__line" d="M16.77 44.27 A46 46 0 1 1 24.76 89.57" />
      <path className="nidos-splash__line" d="M82.98 40.72 A30 30 0 1 1 54.79 30.46" />
      <circle className="nidos-splash__dot" cx="60" cy="60" r="9" />
    </svg>
  )
}

export function NidosSplash({ nonce }: { nonce?: string }) {
  return (
    <>
      {/* The browser hides a nonce from the DOM after parsing, so hydration sees it as empty. */}
      <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: onceScript }} />
      <style nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: css }} />
      <div className="nidos-splash" aria-hidden="true">
        <div className="nidos-splash__stage">
          <div className="nidos-splash__grow">
            <div className="nidos-splash__tile">
              <div className="nidos-splash__clip">
                <NestMark className="nidos-splash__zoom" />
                <span className="nidos-splash__sheen" />
              </div>
              <div className="nidos-splash__rim" />
            </div>
          </div>
          <NestMark className="nidos-splash__bare" />
          <span className="nidos-splash__word">Project Nidos</span>
        </div>
      </div>
    </>
  )
}
