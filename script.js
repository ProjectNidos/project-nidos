// Cookie Consent Banner — GDPR-compliant bilingual (LV/EN)
(function() {
    const consent = localStorage.getItem('cookie_consent');
    if (consent === 'accepted' || consent === 'declined') return;

    const isEN = window.location.pathname.includes('-en');
    const t = {
        text: isEN
            ? 'This site uses only essential cookies — no tracking, no ads. Choosing "Decline" means no cookies will be stored.'
            : 'Šī vietne izmanto tikai nepieciešamās sīkdatnes — bez izsekošanas, bez reklāmām. Izvēloties "Noraidīt", netiks saglabātas nekādas sīkdatnes.',
        policy: isEN ? 'Cookie Policy' : 'Sīkdatņu politika',
        decline: isEN ? 'Decline' : 'Noraidīt',
        accept: isEN ? 'Accept' : 'Apstiprināt'
    };

    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.innerHTML = '<div class="cookie-banner-inner">' +
        '<p>' + t.text + ' ' +
        '<a href="/nidos/cookie-policy.html">' + t.policy + '</a></p>' +
        '<div class="cookie-buttons">' +
            '<button id="cookie-decline" class="btn-secondary" style="white-space:nowrap;">' + t.decline + '</button>' +
            '<button id="cookie-accept" class="btn-primary" style="white-space:nowrap;">' + t.accept + '</button>' +
        '</div>' +
    '</div>';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:var(--bg-secondary);border-top:1px solid var(--border-color);padding:1rem 0;backdrop-filter:blur(12px);';

    document.body.appendChild(banner);

    function hideBanner() {
        banner.style.transition = 'opacity 0.3s, transform 0.3s';
        banner.style.opacity = '0';
        banner.style.transform = 'translateY(20px)';
        setTimeout(function() { banner.remove(); }, 300);
    }

    document.getElementById('cookie-accept').addEventListener('click', function() {
        localStorage.setItem('cookie_consent', 'accepted');
        hideBanner();
    });

    document.getElementById('cookie-decline').addEventListener('click', function() {
        localStorage.setItem('cookie_consent', 'declined');
        hideBanner();
    });
})();


// Inject premium momentum scrolling (Lenis) globally
const lenisScript = document.createElement('script');
lenisScript.src = 'https://unpkg.com/lenis@1.1.20/dist/lenis.min.js';
lenisScript.onload = () => {
    const lenis = new Lenis({
        autoRaf: true,
        lerp: 0.06,
        smoothWheel: true
    });
};
document.head.appendChild(lenisScript);

// Intersection Observer for Animations
class AnimateOnScroll {
    constructor() {
        this.init();
    }

    init() {
        const observer = new IntersectionObserver((entries) => {
            let delay = 0;
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.transitionDelay = `${delay}s`;
                    entry.target.classList.add('animate-in');
                    observer.unobserve(entry.target);
                    delay += 0.08;
                }
            });
        }, {
            threshold: 0,
            rootMargin: '0px 0px 100px 0px'
        });

        document.querySelectorAll('.bento-card, .contact-info, .contact-form, .section-header, .hero-content > *').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            observer.observe(el);
        });

        const style = document.createElement('style');
        style.textContent = `
            .animate-in {
                opacity: 1 !important;
                transform: translateY(0) !important;
            }
        `;
        document.head.appendChild(style);
    }
}

// Intro Sequence (runs immediately — DOM already ready at end of body)
(() => {
    const introScreen = document.querySelector('.intro-screen');
    const introLogo = document.querySelector('.intro-logo');
    
    if (introScreen && introLogo) {
        // Step 1: Fade in logo quickly
        setTimeout(() => {
            introLogo.classList.add('show');
        }, 100);
        
        // Step 2: Hide intro screen and slide main up
        setTimeout(() => {
            introScreen.classList.add('slide-up');
            const mainContent = document.querySelector('main');
            if(mainContent) mainContent.classList.remove('intro-active');
            
            // Wait for slide up to finish before showing main content
            setTimeout(() => {
                new AnimateOnScroll();
            }, 800); 
        }, 2200);
    } else {
        new AnimateOnScroll();
    }
})()
    
    // --- Floating Service Chatbot for all four services ---
    const serviceCards = document.querySelectorAll('.service-card[data-service]');
    const serviceChat = document.getElementById('service-chat');
    const chatMessages = document.querySelector('.floating-chat-messages');
    const chatForm = document.querySelector('.floating-chat-form');
    const chatInput = document.querySelector('.floating-chat-input');
    const chatClose = document.querySelector('.floating-chat-close');
    const chatSendBtn = document.querySelector('.floating-chat-send');
    const chatTitleEl = document.getElementById('chat-title');
    const chatSubtitleEl = document.getElementById('chat-subtitle');

    const serviceFlows = {
        en: {
            strategy: {
                title: "Digital Strategy Chat",
                subtitle: "Answer a few questions & we’ll prepare strategy next steps.",
                intro: "Hi, I’m your Project Nidos digital strategy assistant.",
                questions: [
                    "First, what does your company do and in which markets do you operate?",
                    "What is the main outcome you want from digital strategy in the next 12 months? (e.g. more leads, efficiency, new markets)",
                    "Roughly how many employees are in your company?",
                    "When would you ideally like to start working on this? (now, 3–6 months, later)"
                ]
            },
            crm: {
                title: "CRM & ERP Chat",
                subtitle: "Let’s see how we can streamline your operations.",
                intro: "Hi, I’m your CRM & ERP assistant.",
                questions: [
                    "What tools or systems are you currently using to manage clients, sales and operations?",
                    "What is the biggest pain point today? (e.g. duplicate data, manual work, poor reporting)",
                    "How many people would actively use a CRM/ERP system in your company?",
                    "Have you already shortlisted any specific platforms or are you open to recommendations?"
                ]
            },
            web: {
                title: "Online Presence Chat",
                subtitle: "Let’s clarify what your website should deliver.",
                intro: "Hi, I’m your online presence assistant.",
                questions: [
                    "Do you already have a website or online store? If yes, please share the URL.",
                    "What is the primary goal of your online presence? (e.g. trust, leads, direct sales)",
                    "Who is your main target audience online?",
                    "Are there any websites you like that reflect what you’re aiming for?"
                ]
            },
            grants: {
                title: "EU Grants Chat",
                subtitle: "We’ll quickly see if there could be a fit with EU funding.",
                intro: "Hi, I’m your EU grants assistant.",
                questions: [
                    "In a sentence or two, what kind of project are you thinking about financing with EU funds?",
                    "Where is your company registered and how many employees do you have?",
                    "Have you applied for EU grants before?",
                    "When would you like to start the project if funding is approved?"
                ]
            }
        },
        lv: {
            strategy: {
                title: "Digitālās stratēģijas čats",
                subtitle: "Atbildiet uz dažiem jautājumiem un mēs sagatavosim nākamos soļus.",
                intro: "Sveiki, es esmu jūsu Projekts Ligzda digitālās stratēģijas asistents.",
                questions: [
                    "Vispirms – ar ko nodarbojas jūsu uzņēmums un kuros tirgos strādājat?",
                    "Kādu galveno rezultātu vēlaties sasniegt ar digitālo stratēģiju nākamo 12 mēnešu laikā? (piemēram, vairāk klientu, efektivitāte, jauni tirgi)",
                    "Aptuveni cik darbinieku ir jūsu uzņēmumā?",
                    "Kad ideāli vēlētos sākt darbu pie šīs tēmas? (tagad, 3–6 mēneši, vēlāk)"
                ]
            },
            crm: {
                title: "CRM un ERP čats",
                subtitle: "Noskaidrosim, kā sakārtot jūsu procesus.",
                intro: "Sveiki, es esmu jūsu CRM un ERP asistents.",
                questions: [
                    "Kādus rīkus vai sistēmas pašlaik izmantojat klientu, pārdošanas un operāciju vadībai?",
                    "Kur šobrīd ir lielākās problēmas? (piemēram, dubulti dati, manuāls darbs, slikts pārskats)",
                    "Cik cilvēki jūsu uzņēmumā aktīvi izmantotu CRM/ERP sistēmu?",
                    "Vai jau esat apsvēruši kādas konkrētas platformas, vai arī esat atvērti ieteikumiem?"
                ]
            },
            web: {
                title: "Tiešsaistes klātbūtnes čats",
                subtitle: "Noskaidrosim, ko jūsu mājaslapai jānodrošina.",
                intro: "Sveiki, es esmu jūsu tiešsaistes klātbūtnes asistents.",
                questions: [
                    "Vai jums jau ir mājaslapa vai interneta veikals? Ja jā, lūdzu, norādiet adresi.",
                    "Kāds ir galvenais mērķis jūsu tiešsaistes klātbūtnei? (piemēram, uzticamība, pieteikumi, tiešie pārdošanas darījumi)",
                    "Kāda ir jūsu galvenā mērķauditorija tiešsaistē?",
                    "Vai ir kādas mājaslapas, kas jums patīk un uz kurām varam orientēties?"
                ]
            },
            grants: {
                title: "ES grantu čats",
                subtitle: "Ātri pārbaudīsim, vai jūsu idejai varētu derēt ES finansējums.",
                intro: "Sveiki, es esmu jūsu ES grantu asistents.",
                questions: [
                    "Dažos teikumos – kādu projektu vēlaties finansēt ar ES līdzekļiem?",
                    "Kur ir reģistrēts jūsu uzņēmums un cik darbinieku tajā strādā?",
                    "Vai iepriekš esat pieteikušies ES grantiem?",
                    "Kad vēlētos sākt projektu, ja finansējums tiktu apstiprināts?"
                ]
            }
        }
    };

    const contactQuestions = {
        en: [
            "To follow up, please share your full name.",
            "And finally, your work email so we can reach you with a tailored proposal."
        ],
        lv: [
            "Lai varam sazināties, lūdzu, norādiet savu vārdu un uzvārdu.",
            "Un visbeidzot – jūsu darba e‑pasts, uz kuru varam nosūtīt piedāvājumu."
        ]
    };

    const messagesByLang = {
        en: {
            invalidEmail: "Please enter a valid work email so we can get back to you.",
            thankYou: "Thank you. We’ll review your answers and come back with concrete next steps."
        },
        lv: {
            invalidEmail: "Lūdzu, ievadiet derīgu darba e‑pastu, lai mēs varētu ar jums sazināties.",
            thankYou: "Paldies! Pārskatīsim jūsu atbildes un nosūtīsim konkrētus nākamos soļus."
        }
    };

    const inputUiByLang = {
        en: {
            placeholder: "Type your answer…",
            sendLabel: "Send"
        },
        lv: {
            placeholder: "Ierakstiet savu atbildi…",
            sendLabel: "Sūtīt"
        }
    };

    let currentServiceKey = null;
    let currentQuestions = [];
    let currentStep = 0;
    const answers = [];

    function addChatMessage(text, author = 'bot') {
        if (!chatMessages) return;
        const bubble = document.createElement('div');
        bubble.className = `chat-message ${author}`;
        bubble.innerHTML = `<p>${text}</p>`;
        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function startServiceChat(serviceKey) {
        const flowsForLang = serviceFlows[currentLang] || serviceFlows.en;
        const flow = flowsForLang[serviceKey];
        if (!serviceChat || !flow) return;

        serviceChat.hidden = false;
        if (chatInput) {
            chatInput.disabled = false;
            chatInput.value = '';
            chatInput.focus();
            const ui = inputUiByLang[currentLang] || inputUiByLang.en;
            chatInput.placeholder = ui.placeholder;
        }
        if (chatSendBtn) {
            const ui = inputUiByLang[currentLang] || inputUiByLang.en;
            chatSendBtn.textContent = ui.sendLabel;
        }
        if (chatMessages) chatMessages.innerHTML = '';
        answers.length = 0;
        currentServiceKey = serviceKey;
        const contactQsForLang = contactQuestions[currentLang] || contactQuestions.en;
        currentQuestions = [...flow.questions, ...contactQsForLang];
        currentStep = 0;

        if (chatTitleEl) chatTitleEl.textContent = flow.title;
        if (chatSubtitleEl) chatSubtitleEl.textContent = flow.subtitle;

        addChatMessage(flow.intro);
        addChatMessage(currentQuestions[currentStep]);
    }

    if (serviceCards.length && serviceChat) {
        serviceCards.forEach(card => {
            card.addEventListener('click', () => {
                const key = card.getAttribute('data-service');
                startServiceChat(key);
            });
        });
    }

    if (chatClose && serviceChat) {
        chatClose.addEventListener('click', () => {
            serviceChat.hidden = true;
        });
    }

    async function submitServiceLeadToCRM(payload) {
        try {
            const res = await fetch('/api/webhooks/form-lead', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                console.error('Failed to submit service lead', await res.text());
            }
        } catch (err) {
            console.error('Error submitting service lead', err);
        }
    }

    if (chatForm && chatInput) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const value = chatInput.value.trim();
            if (!value || !currentQuestions.length) return;

            addChatMessage(value, 'user');
            answers.push({ question: currentQuestions[currentStep], answer: value });
            chatInput.value = '';
            chatInput.focus(); // Keep keyboard open

            currentStep += 1;

            if (currentStep < currentQuestions.length) {
                setTimeout(() => {
                    addChatMessage(currentQuestions[currentStep]);
                }, 500); // Small delay for natural feel
            } else {
                const nameAnswer = answers[answers.length - 2]?.answer || '';
                const emailAnswer = answers[answers.length - 1]?.answer || '';

                // Stricter Email Validation
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(emailAnswer)) {
                    const invalidMsg = messagesByLang[currentLang]?.invalidEmail || messagesByLang.en.invalidEmail;
                    addChatMessage(invalidMsg, 'bot');
                    currentStep = currentQuestions.length - 1; // Repeat email question
                    return;
                }

                const thankYouMsg = messagesByLang[currentLang]?.thankYou || messagesByLang.en.thankYou;
                addChatMessage(thankYouMsg, 'bot');

                // Generate "Conclusion" / Structured Profile
                const flow = (serviceFlows[currentLang] || serviceFlows.en)[currentServiceKey];
                const labels = [
                    "🏢 Industry/Market",
                    "🎯 Primary Goal",
                    "👥 Company Size",
                    "⏳ Timeline",
                    "👤 Contact Name",
                    "📧 Email"
                ];

                let formattedMessage = `=== LEAD SNAPSHOT ===\n\n`;
                formattedMessage += `SOURCE: ${flow.title}\n`;
                formattedMessage += `-------------------\n`;

                answers.forEach((a, i) => {
                    // Use custom label if available, otherwise fallback to "Q"
                    const label = i < labels.length ? labels[i] : `Question ${i + 1}`;
                    formattedMessage += `**${label}**:\n${a.answer}\n\n`;
                });

                await submitServiceLeadToCRM({
                    name: nameAnswer,
                    email: emailAnswer,
                    phone: '',
                    message: formattedMessage, // Send structured conclusion
                    source: currentServiceKey || 'service_chat'
                });

                chatInput.disabled = true;
            }
        });
    }

    // --- Contact form -> CRM lead ---
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = contactForm.querySelector('#name');
            const emailInput = contactForm.querySelector('#email');
            const messageInput = contactForm.querySelector('#message');

            const name = nameInput?.value.trim() || '';
            const email = emailInput?.value.trim() || '';
            const message = messageInput?.value.trim() || '';

            if (!email) {
                alert('Please enter your email.');
                return;
            }

            try {
                const res = await fetch('/api/webhooks/form-lead', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name,
                        email,
                        phone: '',
                        message,
                        source: 'website_contact_form'
                    })
                });

                if (!res.ok) {
                    console.error('Failed to submit contact form lead', await res.text());
                    alert('There was a problem submitting your message. Please try again later.');
                    return;
                }

                alert('Thank you! We will get back to you soon.');
                contactForm.reset();
            } catch (err) {
                console.error('Error submitting contact form lead', err);
                alert('There was a problem submitting your message. Please try again later.');
            }
        });
    }

    // --- Smooth Scroll handled by Lenis ---
});
