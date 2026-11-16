import { Section, Table, Mail } from './prose';

// Latvian version of PrivacyEn.tsx. Keep the two in step.
export const UPDATED_LV = '2026. gada 16. novembrī';

export default function PrivacyLv() {
  return (
    <>
      <p className="mt-6 text-[16px] leading-relaxed text-ink/85">
        Ko mēs uzzinām par jums, kad lietojat šo vietni vai sazināties ar mums, kur šie dati tiek glabāti un ko jūs
        varat lūgt mums ar tiem darīt.
      </p>

      <Section n={1} title="Kas mēs esam">
        <p>SIA Project Nidos ir šajā politikā aprakstīto personas datu pārzinis.</p>
        <p>
          SIA Project Nidos, reģ. Nr. 40203751563, PVN LV40203751563, Paula Lejiņa iela 4 - 42, Rīga, LV-1029, Latvija.
          E-pasts: <Mail />.
        </p>
        <p>
          Mēs iestatām Google veikalus, veidojam mākslīgā intelekta risinājumus konkrētiem procesiem, digitalizējam
          uzņēmumus atbilstoši ES regulējumam un uzturam mūsu ieviestās sistēmas. Šī politika attiecas uz mūsu vietni
          projectnidos.eu un mūsu saziņu ar cilvēkiem, ar kuriem runājam par šo darbu. Ja projekta laikā apstrādājam
          personas datus klienta sistēmās, mēs to darām klienta vārdā saskaņā ar atsevišķu datu apstrādes līgumu.
        </p>
      </Section>

      <Section n={2} title="Ko mēs vācam">
        <p>
          <strong className="font-medium text-ink">Kad izmantojat kontaktformu:</strong> jūsu vārdu, e-pasta adresi,
          uzņēmumu (ja to norādāt), interesējošo pakalpojumu un ziņu. Tos glabājam kopā ar datumu un lapas valodu, un tos
          lasa Project Nidos komanda mūsu administrācijas panelī.
        </p>
        <p>
          <strong className="font-medium text-ink">Kad rakstāt mums e-pastu:</strong> jūsu e-pasta adresi, ziņu un
          pielikumus, kā arī ziņas, ko parasti satur e-pasta galvenes.
        </p>
        <p>
          <strong className="font-medium text-ink">Kad strādājam kopā vai to apspriežam:</strong> jūsu vārdu, darba
          e-pastu, tālruni, uzņēmumu un amatu, kā arī mūsu piezīmes no sarunām un tikšanās reizēm. Ja sazināmies ar jums
          pirmie, izmantojam darba kontaktinformāciju, ko jūs vai jūsu uzņēmums ir publiskojis, un pirmajā ziņā norādām,
          kur to atradām.
        </p>
        <p>
          <strong className="font-medium text-ink">Kad apmeklējat vietni:</strong> tāpat kā jebkurš tīmekļa serveris,
          mūsējais redz jūsu IP adresi, pārlūka veidu, pieprasīto lapu un laiku; mitināšanas pakalpojuma sniedzējs šos
          pieprasījumu žurnālus glabā īsu laiku (6. sadaļa). Apmeklējumus skaitām arī paši: kuras lapas tiek skatītas,
          kura vietne vai kampaņas saite jūs atveda, vai izmantojāt tālruni, planšeti vai datoru, un vai noklikšķinājāt
          uz pakalpojuma vai nosūtījāt formu. Lai apmeklējumus atšķirtu, izmantojam kodu, ko aprēķina no jūsu IP adreses un
          pārlūka, slepenas atslēgas un datuma. Kods mainās katru dienu, no tā nevar atjaunot jūsu IP adresi, un pati IP
          adrese kopā ar to netiek glabāta, tāpēc ar to nevar jums sekot no vienas dienas uz nākamo.
        </p>
        <p>
          <strong className="font-medium text-ink">Jūsu pārlūkā:</strong> nekas. Vietne neizmanto sīkdatnes un neko
          nesaglabā jūsu ierīcē, tāpēc sīkdatņu paziņojuma nav.
        </p>
        <p>
          <strong className="font-medium text-ink">Ko mēs nedarām:</strong> neizmantojam trešo pušu analītiku,
          izsekošanas pikseļus, reklāmas tīklus, sociālo tīklu spraudņus, pirkstu nospiedumu noteikšanu vai trešo pušu
          skriptus. Fonti, attēli un video tiek piegādāti no mūsu servera, tāpēc lapas ielāde nevienam citam neatklāj, ka
          to apmeklējāt.
        </p>
      </Section>

      <Section n={3} title="Kāpēc mēs tos izmantojam un uz kāda pamata">
        <p>Katrs izmantošanas veids balstās uz vienu no VDAR 6. panta 1. punkta pamatiem:</p>
        <Table
          head={['Mērķis', 'Tiesiskais pamats']}
          rows={[
            ['Atbildēt uz jūsu jautājumu un sagatavot piedāvājumu', 'Jūsu lūgti pasākumi pirms līguma noslēgšanas — 6. panta 1. punkta b) apakšpunkts'],
            [
              'Sniegt pakalpojumus un izrakstīt rēķinus',
              'Līguma izpilde — b) apakšpunkts; grāmatvedības dokumenti saskaņā ar Latvijas tiesību aktiem — c) apakšpunkts',
            ],
            [
              'Sazināties ar darījumu kontaktiem, arī pirmie',
              'Mūsu leģitīmās intereses atrast un apkalpot klientus — f) apakšpunkts',
            ],
            ['Skaitīt apmeklējumus, lai saprastu, kuras lapas un pakalpojumi ir noderīgi', 'Mūsu leģitīmās intereses uzlabot vietni — f) apakšpunkts'],
            ['Uzturēt vietni drošu un darbspējīgu', 'Mūsu leģitīmās intereses nodrošināt drošu pakalpojumu — f) apakšpunkts'],
          ]}
        />
        <p>
          Ja balstāmies uz leģitīmajām interesēm, jūs jebkurā laikā varat iebilst, un darījumu saziņu mēs vienkārši
          pārtrauksim. Mēs nepārdodam personas datus, neizmantojam tos reklāmai un nepieņemam lēmumus par jums automatizēti.
        </p>
      </Section>

      <Section n={4} title="Kas vēl tos redz">
        <p>Šie pakalpojumu sniedzēji apstrādā personas datus mūsu vārdā saskaņā ar VDAR 28. panta prasībām atbilstošiem datu apstrādes noteikumiem:</p>
        <Table
          head={['Pakalpojuma sniedzējs', 'Ko tas dara mūsu labā', 'Kur']}
          rows={[
            ['Railway Corporation', 'Mitina vietni un glabā pieprasījumu žurnālus', 'ES (Nīderlande)'],
            ['Supabase Inc.', 'Datubāze pieteikumiem un apmeklējumu statistikai; administratora pieteikšanās', 'ES (Vācija)'],
            ['GoDaddy', 'E-pasts support@projectnidos.eu', 'ASV'],
          ]}
        />
        <p>
          Project Nidos iekšienē pieteikumus redz tikai tie darbinieki, kuriem tas nepieciešams. Citādi personas datus
          nododam tikai tad, ja to prasa likums, vai ar jūsu piekrišanu partnerim, kuru lūdzat iesaistīt projektā.
        </p>
      </Section>

      <Section n={5} title="Nodošana ārpus ES">
        <p>
          Vietne un tās datubāze tiek mitināta ES. E-pastu apstrādā GoDaddy Amerikas Savienotajās Valstīs; šī nodošana
          balstās uz Eiropas Komisijas standarta līguma klauzulām un, ja pakalpojuma sniedzējs ir sertificēts, ES–ASV Datu
          privātuma regulējumu. Railway un Supabase ir ASV uzņēmumi; to datu apstrādes noteikumos ir tādas pašas garantijas.
          To kopiju varat pieprasīt, rakstot uz <Mail />.
        </p>
      </Section>

      <Section n={6} title="Cik ilgi mēs tos glabājam">
        <ul>
          <li>Pieteikumi, kas nekļūst par projektu: dzēšam 12 mēnešus pēc pēdējās saziņas.</li>
          <li>Darījumu kontakti, ar kuriem sazinājāmies pirmie: dzēšam 12 mēnešus pēc pēdējās saziņas vai uzreiz, ja iebilstat.</li>
          <li>
            Klientu un projektu dati: glabājam sadarbības laikā un 5 gadus pēc tās, lai izpildītu Latvijas grāmatvedības
            prasības un risinātu iespējamās pretenzijas.
          </li>
          <li>E-pasts: glabājam ar tiem pašiem nosacījumiem kā pieteikumu vai projektu, pie kura tas pieder.</li>
          <li>Apmeklējumu statistika: dzēšam pēc 13 mēnešiem.</li>
          <li>Pieprasījumu žurnāli: mitināšanas pakalpojuma sniedzējs tos glabā ne ilgāk kā 30 dienas, tad tie tiek dzēsti automātiski.</li>
        </ul>
      </Section>

      <Section n={7} title="Jūsu tiesības">
        <p>Saskaņā ar VDAR 15.–22. pantu jūs varat lūgt mums:</p>
        <ul>
          <li>parādīt, kādus jūsu personas datus glabājam, un izsniegt to kopiju;</li>
          <li>labot nepareizo;</li>
          <li>tos dzēst;</li>
          <li>ierobežot to izmantošanu, kamēr tiek risināts jautājums par tiem;</li>
          <li>nodot tos mašīnlasāmā formātā jums vai citam uzņēmumam;</li>
          <li>pārtraukt to izmantošanu, ja balstāmies uz leģitīmajām interesēm, un tiešajā mārketingā vienmēr.</li>
        </ul>
        <p>
          Rakstiet uz <Mail />. Atbildam viena mēneša laikā; sarežģītiem pieprasījumiem varam izmantot vēl līdz diviem
          mēnešiem un pateiksim, kāpēc (VDAR 12. panta 3. punkts). Iespējams, vispirms lūgsim apstiprināt jūsu identitāti.
        </p>
      </Section>

      <Section n={8} title="Sūdzības">
        <p>
          Ja uzskatāt, ka esam rīkojušies ar jūsu datiem nepareizi, vispirms pastāstiet mums, un mēs centīsimies to
          labot. Varat arī iesniegt sūdzību Latvijas uzraudzības iestādei vai iestādei valstī, kurā dzīvojat vai strādājat:
          Datu valsts inspekcija, Elijas iela 17, Rīga, LV-1050,{' '}
          <a href="https://www.dvi.gov.lv" rel="noopener noreferrer">www.dvi.gov.lv</a>.
        </p>
      </Section>

      <Section n={9} title="Bērni">
        <p>Mūsu vietne un pakalpojumi ir paredzēti uzņēmumiem. Mēs apzināti nevācam bērnu personas datus.</p>
      </Section>

      <Section n={10} title="Izmaiņas un saziņa">
        <p>
          Mainot šo politiku, atjaunojam datumu lapas augšā. Ja izmaiņas būtiski skar jau glabātos datus, par to tieši
          informējam attiecīgās personas. Jautājumi par privātumu: <Mail /> vai pa pastu SIA Project Nidos, Paula Lejiņa
          iela 4 - 42, Rīga, LV-1029.
        </p>
      </Section>
    </>
  );
}
