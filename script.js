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
    
    // --- Data Dictionary for Translations ---
    const i18n = {
        en: {
            nav_about: "About",
            nav_services: "Services",
            nav_why_us: "Why Us",
            nav_contact: "Contact Us",
            hero_slogan: "With Project Nidos",
            hero_title: 'Empowering Your <br><span class="gradient-text">Digital Transformation</span>',
            hero_subtitle: "We deliver audit-defensible EU compliance software, corporate digitalization, and strategic EU grant mapping. Official unbin.io representatives.",
            hero_cta: "Get Started",
            hero_services: "Our Services",
            about_title: "Bridging the Digital Gap",
            about_mission_title: "Our Mission",
            about_mission_text: "We specialize in helping successful companies take the next step. We don't just consult, we ship. You have the profit, now it's time for systems that pass Big-4 audits and scale.",
            about_approach_title: "Our Approach",
            about_approach_text: "From EU grant acquisition to implementing robust CRM systems and EU compliance reporting, we handle the digitalization journey end-to-end with deep technical provenance.",
            services_title: "Comprehensive Solutions",
            service_strategy_title: "Digital Strategy",
            service_strategy_text: "We build comprehensive digital strategies to future-proof your business. From enterprise architecture design to full-scale digital transformation, we align technology with your core business objectives to drive measurable B2B growth.",
            service_crm_title: "CRM & ERP Systems",
            service_crm_text: "Implement audit-defensible CRM and ERP solutions that scale with your enterprise. We specialize in complex data migrations and deploying top-tier software that provides a single source of truth.",
            service_compliance_title: "EU Compliance & unbin.io",
            service_compliance_text: "As official representatives of unbin.io, we deliver rigorous EU compliance software for CSRD, CBAM, NIS2, DORA, and ETS reporting. We automate complex regulatory data gathering so your business is always audit-ready.",
            service_grants_title: "EU Grants",
            service_grants_text: "We map and secure strategic EU funding for your innovation projects. Our experts navigate the complex grant ecosystems, ensuring your applications are meticulously prepared and aligned with European digitalization goals.",
            whyup_title: "Why Partner With Us?",
            benefit_1: "Expertise in EU Funding Ecosystems",
            benefit_2: "Network of Specialized IT Partners",
            benefit_3: "Tailored Solutions, Not Cookie-Cutter Fixes",
            benefit_4: "Focus on Profitable, Growth-Ready Companies",
            contact_title: "Let's Grow Together",
            contact_info_title: "Contact Information",
            form_name: "Name",
            form_email: "Email",
            form_message: "Message",
            form_submit: "Send Message"
        },
        lv: {
            nav_about: "Par mums",
            nav_services: "Pakalpojumi",
            nav_why_us: "Kāpēc mēs",
            nav_contact: "Kontakti",
            hero_slogan: "Kopā ar Projekts Ligzda",
            hero_title: 'Veiciniet Savu <br><span class="gradient-text">Digitālo Transformāciju</span>',
            hero_subtitle: "Mēs piegādājam audita prasībām atbilstošu ES regulāciju programmatūru, korporatīvo digitalizāciju un ES grantu piesaisti. Oficiālie unbin.io pārstāvji.",
            hero_cta: "Sākt sadarbību",
            hero_services: "Pakalpojumi",
            about_title: "Digitālās Izaugsmes Tilts",
            about_mission_title: "Mūsu Misija",
            about_mission_text: "Mēs specializējamies, palīdzot veiksmīgiem uzņēmumiem spert nākamo soli. Mēs ne tikai konsultējam, mēs ieviešam. Ir pienācis laiks sistēmām, kas iztur Big-4 auditu un ļauj augt.",
            about_approach_title: "Mūsu Pieeja",
            about_approach_text: "No ES grantu piesaistes līdz spēcīgu CRM sistēmu un ES atbilstības ziņošanas ieviešanai - mēs vadām digitalizācijas procesu ar dziļu tehnisku precizitāti.",
            services_title: "Visaptveroši Risinājumi",
            service_strategy_title: "Digitālā Stratēģija",
            service_strategy_text: "Mēs izstrādājam visaptverošas digitālās stratēģijas jūsu biznesa nākotnei. No uzņēmuma arhitektūras dizaina līdz pilnai digitālajai transformācijai – mēs salāgojam tehnoloģijas ar jūsu mērķiem.",
            service_crm_title: "CRM un ERP Sistēmas",
            service_crm_text: "Ieviešam audita prasībām atbilstošus CRM un ERP risinājumus, kas aug kopā ar jūsu uzņēmumu. Mēs specializējamies sarežģītās datu migrācijās un sistēmu integrācijā.",
            service_compliance_title: "ES Regulācijas un unbin.io",
            service_compliance_text: "Kā oficiālie unbin.io pārstāvji mēs piegādājam stingrus ES atbilstības risinājumus CSRD, CBAM, NIS2, DORA un ETS ziņošanai. Mēs automatizējam datu apstrādi, lai uzņēmums vienmēr būtu gatavs auditam.",
            service_grants_title: "ES Granti",
            service_grants_text: "Mēs piesaistām stratēģisku ES finansējumu jūsu inovāciju projektiem. Mūsu eksperti nodrošina, ka jūsu pieteikumi ir sagatavoti perfekti un atbilst Eiropas mērķiem.",
            whyup_title: "Kāpēc Sadarboties?",
            benefit_1: "Ekspertīze ES finansējuma ekosistēmās",
            benefit_2: "Specializētu IT partneru tīkls",
            benefit_3: "Pielāgoti risinājumi, nevis šabloni",
            benefit_4: "Fokuss uz pelnošiem, augošiem uzņēmumiem",
            contact_title: "Augsim Kopā",
            contact_info_title: "Kontaktinformācija",
            form_name: "Vārds",
            form_email: "E-pasts",
            form_message: "Ziņa",
            form_submit: "Nosūtīt ziņu"
        }
    };

    // --- Language Switching Logic ---
    const langBtns = document.querySelectorAll('.lang-btn');
    const elementsToTranslate = document.querySelectorAll('[data-i18n]');
    let currentLang = 'en';

    function setLanguage(lang) {
        // Update Content
        elementsToTranslate.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (i18n[lang][key]) {
                // If the content involves HTML (marked in our dict with HTML tags), use innerHTML
                if (i18n[lang][key].includes('<')) {
                    el.innerHTML = i18n[lang][key];
                } else {
                    el.textContent = i18n[lang][key];
                }
            }
        });

        currentLang = lang;

        // Update Active Button State
        langBtns.forEach(btn => {
            if (btn.getAttribute('data-lang') === lang) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Optional: Save preference
        // localStorage.setItem('prefLang', lang); 
    }

    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            setLanguage(lang);
        });
    });

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
