'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import ProjectsAssistant from '@/app/components/ProjectsAssistant';
import Header from '@/app/components/Header';

type Topic = {
  id: number;
  title: string;
  department: string;
  description: string | null;
  pages: number | null;
  chapters: string | null;
  format: string | null;
  year: number | null;
  level: string;
  price: number;
};

type Addon = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  price_type?: string;
  features?: { name: string; price: number }[];
  is_location_changer?: boolean;
};

type Cart = {
  topicId?: number;
  customTitle?: string;
  department?: string;
  level: string;
  title: string;
  basePrice: number;
};

const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG');
const PAGE_SIZE = 30;

const NIGERIAN_DEPARTMENTS = [
  "Accountancy / Accounting",
  "Actuarial Science",
  "Adult Education",
  "Agricultural Economics",
  "Agricultural Engineering",
  "Agricultural Science",
  "Anatomy",
  "Animal Science",
  "Applied Biochemistry",
  "Applied Chemistry",
  "Architecture",
  "Banking and Finance",
  "Biochemistry",
  "Biological Sciences",
  "Botany",
  "Business Administration",
  "Chemical Engineering",
  "Chemistry",
  "Civil Engineering",
  "Civil Law",
  "Common Law",
  "Computer Engineering",
  "Computer Science",
  "Cooperative and Rural Development",
  "Creative Arts",
  "Dentistry",
  "Economics",
  "Educational Management",
  "Electrical / Electronic Engineering",
  "English Language",
  "English and Literary Studies",
  "Estate Management",
  "Fine and Applied Arts",
  "Fisheries and Aquaculture",
  "Food Science and Technology",
  "Forestry and Wildlife Management",
  "Geography",
  "Geology",
  "Guidance and Counseling",
  "History and International Studies",
  "Industrial Chemistry",
  "Industrial Relations and Personnel Management",
  "Insurance",
  "International Relations",
  "Library and Information Science",
  "Linguistics",
  "Mass Communication",
  "Mathematics",
  "Mechanical Engineering",
  "Mechatronics Engineering",
  "Medical Laboratory Science",
  "Medicine and Surgery",
  "Microbiology",
  "Music",
  "Nursing Science",
  "Optometry",
  "Petroleum Engineering",
  "Pharmacy",
  "Philosophy",
  "Physics",
  "Physiology",
  "Political Science",
  "Public Administration",
  "Public Health",
  "Quantity Surveying",
  "Radiography",
  "Religious Studies",
  "Sociology",
  "Statistics",
  "Surveying and Geoinformatics",
  "Theatre Arts",
  "Urban and Regional Planning",
  "Veterinary Medicine",
  "Zoology"
];

// ---- Tribe-grouped writer name pools (700+ names, 15+ Nigerian tribes) ----

// IGBO (~50 first, ~40 last)
const IGBO_FIRST = [
  "Chidi", "Emeka", "Kelechi", "Uchenna", "Tochukwu", "Nonso", "Ejike", "Nnamdi", "Ngozi", "Chioma",
  "Chinyere", "Ifeoma", "Ogechi", "Uju", "Ezinne", "Nneka", "Chinedu", "Chika", "Ezenwa", "Obinna",
  "Somto", "Uche", "Ikechukwu", "Goziem", "Adaeze", "Onyekachi", "Chiamaka", "Ogochukwu", "Obiageli",
  "Chinonso", "Chibuike", "Ugochi", "Adannaya", "Amarachi", "Uchechukwu", "Nkiruka", "Chinaza", "Ebube",
  "Odinaka", "Chidinma", "Onyeka", "Ifunanya", "Chibundo", "Tobenna", "Kenechukwu", "Chimamanda",
  "Ginika", "Ugochukwu", "Obioma", "Chukwuemeka", "Onyedikachi", "Chigozie", "Akachukwu",
  "Nwanneka", "Ezechukwu", "Amaka", "Chizoba", "Onyinye", "Ugomma", "Adanna",
];
const IGBO_LAST = [
  "Okeke", "Okafor", "Nwosu", "Okoye", "Nwachukwu", "Opara", "Diala", "Ezeugo", "Onuoha", "Eze",
  "Obi", "Okoro", "Chukwu", "Igwe", "Kalu", "Onyema", "Uba", "Nwankwo", "Obiora", "Aniagu",
  "Ugwu", "Nwofor", "Onyekwere", "Ezeaku", "Nwogu", "Ogbuagu", "Nweze", "Umeh", "Agu", "Ogbu",
  "Nwafor", "Onyemenam", "Ezeilo", "Onwudiwe", "Nzekwe", "Okonkwo", "Ihejirika", "Obasi", "Okpara",
  "Nnaji", "Ojukwu", "Onyia", "Eze-Onwu", "Mbah", "Nwagbo", "Ezeh", "Asadu", "Anigbo",
];

// YORUBA (~50 first, ~40 last)
const YORUBA_FIRST = [
  "Olumide", "Babajide", "Tunde", "Segun", "Adebayo", "Femi", "Kunle", "Jide", "Kola", "Dayo",
  "Wale", "Damilola", "Temitope", "Gbolahan", "Yetunde", "Funmilayo", "Tolani", "Kemi", "Shade",
  "Adesua", "Bisola", "Eniola", "Folake", "Ronke", "Tolu", "Yemisi", "Seyi", "Bisi",
  "Dapo", "Gbenga", "Leke", "Muyiwa", "Tobi", "Yinka", "Biyi", "Tokunbo", "Mide", "Wole",
  "Oluwaseun", "Adedayo", "Temitayo", "Oluwafemi", "Adeola", "Taiwo", "Kehinde", "Opeyemi",
  "Oluwatobi", "Ayobami", "Oluwakemi", "Oluwaseyi", "Adeleke", "Adewale", "Olubunmi", "Ifeoluwa",
  "Ayooluwa", "Omowunmi", "Adefunke", "Aderopo", "Bukola", "Motunrayo",
];
const YORUBA_LAST = [
  "Balogun", "Adebayo", "Ojo", "Alabi", "Babalola", "Awolowo", "Soyinka", "Adenuga", "Alakija",
  "Adeleke", "Abiola", "Falz", "Bankole", "Akinyemi", "Coker", "Oluwole", "Adeyemi", "Alonge",
  "Olatunji", "Daramola", "Oyinlola", "Akenzua", "Fagbemi", "Ajayi", "Osinbajo", "Ogundipe",
  "Adeboye", "Olanrewaju", "Oduya", "Babatunde", "Afolabi", "Gbadebo", "Fasanya", "Ayoola",
  "Olopade", "Animashaun", "Lawal", "Makinde", "Adesanya", "Adegboye", "Obafemi", "Osuntokun",
  "Ikuforiji", "Okulaja", "Adeyinka", "Olaleye",
];

// HAUSA-FULANI (~40 first, ~30 last)
const HAUSA_FIRST = [
  "Abdul", "Aminu", "Ibrahim", "Musa", "Yusuf", "Usman", "Amina", "Zainab", "Halima", "Fatimah",
  "Aisha", "Lawal", "Aliyu", "Sani", "Bello", "Maryam", "Hafsat", "Ruqayyah", "Bilkisu", "Hauwa",
  "Abdullahi", "Ismail", "Nuhu", "Yakubu", "Idris", "Rabiu", "Habib", "Nasiru", "Zubairu",
  "Ramatu", "Khadijah", "Fadimatu", "Suwaiba", "Asabe", "Jummai", "Hadiza", "Mairo", "Saratu",
  "Bashir", "Haruna", "Tijjani", "Suleiman",
];
const HAUSA_LAST = [
  "Bello", "Ibrahim", "Abubakar", "Garba", "Usman", "Mohammed", "Dangote", "Danjuma", "Shagari",
  "Sanusi", "Lamido", "Buhari", "Gowon", "Dikko", "Kwankwaso", "Aliyu", "Sule",
  "Abdullahi", "Musa", "Inuwa", "Gambo", "Wada", "Bashir", "Tukur", "Tanko", "Hassan", "Adamu",
  "Maikasuwa", "Tsangaya", "Ringim",
];

// FULANI (~25 first, ~20 last) — distinct from Hausa naming patterns
const FULANI_FIRST = [
  "Modibo", "Hammadu", "Siradio", "Oumarou", "Adama", "Amadou", "Boubacar", "Hawa", "Mariama",
  "Fatoumata", "Balkissa", "Nenneh", "Ramata", "Binta", "Djamila", "Ardo", "Musa", "Umaru",
  "Hamidu", "Yelwa", "Jibril", "Ahmadu", "Aliou", "Kadija", "Hadijatou",
];
const FULANI_LAST = [
  "Barry", "Balde", "Diallo", "Jallo", "Sow", "Ba", "Bah", "Tall", "Toure", "Camara",
  "Bello", "Yero", "Sule", "Mamman", "Sambo", "Mairiga", "Danfodio", "Labbo",
];

// IJaw / IZON (~30 first, ~25 last)
const IJAW_FIRST = [
  "Peremo", "Ebiowei", "Doubara", "Suoton", "Tamaraebi", "Ebiakpo", "Diepreye", "Opuofoni",
  "Ayibakuro", "Bibowei", "Timi", "Angala", "Erefawei", "Preye", "Taribo", "Adaka", "Boma",
  "Ebiere", "Doris", "Oyinkuro", "Eruotor", "Tamaraufa", "Kemesowei", "Ibifuro", "Tamuno",
  "Opibi", "Bioye", "Ebiowei", "Oruene", "Youfa",
];
const IJAW_LAST = [
  "Okoko", "Amapu", "Owei", "Okoya", "Tombia", "Kpakiama", "Tebepah", "Egbe", "Inengite",
  "Gbonewei", "Dokubo", "Oki", "Ebiri", "Amabebe", "Ayawei", "Akpoebi", "Tonye",
  "Binitie", "Ebizimor", "Dimieari", "Poloamina", "Preye", "Arubai", "Seibarugu",
];

// EFIK (~25 first, ~20 last)
const EFIK_FIRST = [
  "Eyo", "Asuquo", "Okon", "Bassey", "Etim", "Ndifreke", "Iquo", "Akon", "Uduak", "Atim",
  "Edidiong", "Uwem", "Ekemini", "Emem", "Ekpe", "Affiong", "Aniema", "Ubong", "Obong", "Ini",
  "Mfon", "Itoro", "Nkereuwem", "Ima", "Nsikak",
];
const EFIK_LAST = [
  "Ekanem", "Ekpo", "Essien", "Bassey", "Okon", "Inyang", "Etim", "Asuquo", "Akpan", "Udofia",
  "Edem", "Nsa", "Effiong", "Ekong", "Usoro", "Utuk", "Eno", "Ukpong", "Ntuk",
];

// IBIBIO (~25 first, ~20 last) — closely related to Efik but distinct
const IBIBIO_FIRST = [
  "Ekpenyong", "Akaninyene", "Idongesit", "Enoobong", "Nsidibe", "Enobong", "Ekemini", "Ifiok",
  "Ndiana", "Ntiense", "Anietie", "Ofonime", "Ekaete", "Obianuju", "Akpabio", "Andem",
  "Ekom", "Uko", "Ndidi", "Idorenyin", "Uduak", "Esit", "Iniobong", "Nkoyo", "Anyim",
];
const IBIBIO_LAST = [
  "Akpan", "Udoh", "Umoh", "Udo", "Ikpe", "Essen", "Ibok", "Ntukidem", "Obot", "Ebong",
  "Udosen", "Edet", "Antia", "Mbong", "Ikot", "Ekerete", "Efiok", "Udoekong", "Ikpeme",
];

// TIV (~25 first, ~20 last)
const TIV_FIRST = [
  "Aondo", "Terhile", "Iorlamen", "Ubam", "Tyav", "Andesikaa", "Iember", "Doosuur", "Terngu",
  "Terdoo", "Mbakor", "Gbaasen", "Bemsen", "Terfa", "Dzua", "Mfon", "Orji", "Mngehen",
  "Anum", "Gyebi", "Kperan", "Mbaaza", "Uyam", "Mfon", "Bur",
];
const TIV_LAST = [
  "Shagbaor", "Iorlaha", "Gbor", "Waya", "Tyem", "Akume", "Suswam", "Awua", "Tor",
  "Tarka", "Iorbee", "Kukwu", "Ugba", "Anure", "Kure", "Dzeremo", "Fanen", "Mbajiua",
];

// EDO / BINI (~30 first, ~25 last)
const EDO_FIRST = [
  "Osaro", "Omosede", "Eghosa", "Osagie", "Osayande", "Itohan", "Adesuwa", "Ehinome",
  "Osazemen", "Omolade", "Eguagie", "Oghenovo", "Omotayo", "Esosa", "Osemwengie", "Ehigie",
  "Osaretin", "Osasuyi", "Omoyemen", "Aidonojie", "Ikponmwosa", "Edokpolor", "Evbuomwan",
  "Aigbogun", "Enabore", "Ehindero", "Okonkwo", "Iyoha", "Isiolo", "Odigie",
];
const EDO_LAST = [
  "Osagie", "Osunde", "Ero", "Ize-Iyamu", "Aigbe", "Omorogbe", "Ogiugo", "Osabuohien",
  "Edokpolor", "Evbayiro", "Igbinosun", "Ekhator", "Odigie", "Ehigie", "Iyawe",
  "Omorodion", "Omoruyi", "Esedebe", "Oronsaye", "Idemudia", "Osemwekha", "Omorogbe",
  "Osegbon", "Ediae", "Ikponmwosa",
];

// URHOBO (~25 first, ~20 last)
const URHOBO_FIRST = [
  "Erhuvwu", "Ogheneruona", "Ogheneovo", "Oghenekaro", "Oghenechovwe", "Oghenevwede",
  "Orode", "Eruotor", "Ovoke", "Ogheneukaro", "Oghenekevwe", "Emoefe", "Ufuoma",
  "Oghenerukewe", "Enuvoke", "Irikefe", "Orobor", "Eruoma", "Oviri", "Orezi",
  "Oghenemine", "Oghene", "Aderukewe", "Oghogho", "Evwruakewe",
];
const URHOBO_LAST = [
  "Okoro", "Okoye", "Eferakeya", "Owhonda", "Egwuogu", "Ekpeki", "Egboka", "Arho",
  "Omonzuanvbo", "Emami", "Egba", "Aghedo", "Adikru", "Ofure", "Okumagba",
  "Oganaka", "Ekwueme", "Etete", "Abraka", "Ovwasa",
];

// ISOKO (~20 first, ~15 last)
const ISOKO_FIRST = [
  "Oghenerukewe", "Oghenekevwe", "Ovwurie", "Erhovwo", "Oweh", "Ogheneochuko",
  "Emerho", "Iruaro", "Ohwovoriole", "Ofevwe", "Adjene", "Ekwuerhe",
  "Avworhe", "Evuarherhe", "Ogheneruwe", "Orhorhoro", "Okiemute", "Oghenerobor",
  "Oghenevwoke", "Ohwovore",
];
const ISOKO_LAST = [
  "Oghenevwoke", "Emiko", "Arhewoh", "Egbo", "Erho", "Ogheneuke", "Isioro",
  "Oviri", "Eferakeya", "Erhieyovwe", "Ohwofa", "Isiavwe", "Ojameruaye", "Oghenemine",
];

// ITSEKIRI (~20 first, ~15 last)
const ITSEKIRI_FIRST = [
  "Ginuwa", "Emiko", "Olu", "Atsepoyi", "Oritseweyinmi", "Oritsegbemi", "Oritsejolomi",
  "Temitayo", "Sola", "Oritseyemisi", "Arese", "Imoru", "Uvieghara",
  "Oritsematosan", "Oloruntoba", "Obaro", "Ogheneruona", "Oghenemine",
  "Ogheneoro", "Eyitayo",
];
const ITSEKIRI_LAST = [
  "Ologbotsere", "Emiko", "Nana", "Ginuwa", "Olu", "Dore", "Atsepoyi",
  "Uwangue", "Oritsemoyemi", "Kakra", "Oriakhi", "Orugbani", "Ajogun", "Omatsola",
];

// NUPE (~20 first, ~15 last)
const NUPE_FIRST = [
  "Bello", "Etsu", "Salihu", "Ndako", "Yisa", "Edibo", "Gana", "Mama", "Doko",
  "Isah", "Ndacefu", "Tajo", "Musa", "Umoru", "Aliyu", "Jibrin",
  "Halima", "Fatima", "Jummai", "Rakiya",
];
const NUPE_LAST = [
  "Ndako", "Bello", "Gana", "Mama", "Masaba", "Etsu", "Doko", "Gari",
  "Cekpa", "Jibrin", "Aliyu", "Sarki", "Umoru", "Shaba",
];

// KANURI (~20 first, ~15 last)
const KANURI_FIRST = [
  "Mustapha", "Kyari", "Bama", "Bukar", "Yerima", "Shettima", "Gana", "Ali",
  "Zannah", "Alkali", "Kachallah", "Goni", "Abba", "Bulama", "Fatima",
  "Hauwa", "Aisha", "Modu", "Lawan", "Umar",
];
const KANURI_LAST = [
  "Shettima", "Kyari", "Gana", "Bukar", "Zannah", "Modu", "Lawan",
  "Kachallah", "Goni", "Mustapha", "Ali", "Imam", "Bulama", "Alhaji",
];

// IGALA (~20 first, ~15 last)
const IGALA_FIRST = [
  "Icheme", "Omale", "Ameh", "Aje", "Ogiri", "Onu", "Akor", "Ejeh", "Ayegba",
  "Agbo", "Okpe", "Okwoli", "Ameh", "Atu", "Ochai", "Ocho", "Ojabo", "Baba",
  "Eneji", "Oche",
];
const IGALA_LAST = [
  "Ameh", "Ayegba", "Agbo", "Akor", "Ejeh", "Ochai", "Onu", "Baba",
  "Okpe", "Ogiri", "Eneji", "Omale", "Oche", "Atanyi",
];

// EBIRA (~20 first, ~15 last)
const EBIRA_FIRST = [
  "Ozigi", "Obaro", "Ohize", "Okene", "Adoh", "Ogbe", "Okutu", "Ozor",
  "Iyabo", "Abioye", "Akene", "Okorie", "Enehe", "Amina", "Yakubu",
  "Halima", "Ibrahim", "Musa", "Ozigis", "Obaro",
];
const EBIRA_LAST = [
  "Ozigi", "Obaro", "Adoh", "Abubakar", "Okene", "Ohize", "Egbunu",
  "Okutu", "Ogbe", "Omadivi", "Ozoh", "Akana", "Otaru", "Ohiole",
];

// IDOMA (~20 first, ~15 last)
const IDOMA_FIRST = [
  "Okpabi", "Attah", "Ogiri", "Adoyi", "Ache", "Ogenyi", "Odoh", "Onah",
  "Ede", "Ogbe", "Omale", "Agbo", "Otu", "Aker", "Ademu", "Ameh",
  "Akpamu", "Elachi", "Ogiri", "Ajobe",
];
const IDOMA_LAST = [
  "Attah", "Agbo", "Ache", "Adoyi", "Onah", "Ogbe", "Ede", "Omale",
  "Aker", "Ademu", "Akpamu", "Elachi", "Ajobe", "Okwoli",
];

// OGONI (~20 first, ~15 last)
const OGONI_FIRST = [
  "Saro-Wiwa", "Nwibia", "Nwibari", "Barigha", "Nwinyiwei", "Nkpuda",
  "Giadom", "Deeyah", "Kpalap", "Naloo", "Sira", "Nwibani", "Bari",
  "Kagbara", "Luah", "Deekor", "Gbalaboribo", "Kpaa", "Doolo", "Gbara",
];
const OGONI_LAST = [
  "Saro-Wiwa", "Nwibari", "Giadom", "Barigha", "Kpalap", "Nkpuda",
  "Luah", "Deekor", "Kagbara", "Naloo", "Gbara", "Badom", "Nwibia",
];

// IKWERRE (~20 first, ~15 last) — distinct Rivers State group, related to Igbo
const IKWERRE_FIRST = [
  "Owunna", "Nwachukwu", "Okereke", "Eke", "Chibuike", "Wosu", "Chibuzo",
  "Nwokolo", "Uchenna", "Obinna", "Chidinma", "Amadi", "Pepple", "Wike",
  "Nkpolu", "Amaechi", "Orlu", "Nwuji", "Ubani", "Okere",
];
const IKWERRE_LAST = [
  "Amadi", "Wosu", "Pepple", "Wike", "Okereke", "Amaechi", "Nkpolu",
  "Ubani", "Nwokolo", "Orlu", "Okere", "Owunna", "Eke", "Nwuji",
];

// ANNANG (~15 first, ~12 last)
const ANNANG_FIRST = [
  "Eno", "Abasifreke", "Nsikak", "Ndifreke", "Affiong", "Iquo", "Edidiong",
  "Uwem", "Emem", "Ndidi", "Ntiense", "Abasi", "Imaobong", "Uduak", "Nkwa",
];
const ANNANG_LAST = [
  "Antia", "Ibok", "Udoh", "Edet", "Obot", "Esen", "Itiat",
  "Ekong", "Udoekong", "Akpan", "Nkpa", "Ebong",
];

// JUKUN (~15 first, ~12 last)
const JUKUN_FIRST = [
  "Aku", "Daji", "Baba", "Wapan", "Gbamji", "Angyu", "Kpanta", "Girmawa",
  "Tukura", "Agbu", "Mela", "Takur", "Ashuku", "Wase", "Dodo",
];
const JUKUN_LAST = [
  "Aku", "Wapan", "Angyu", "Tukura", "Agbu", "Gbamji", "Mela",
  "Takur", "Daji", "Ashuku", "Wase", "Girmawa",
];

// English / Christian names — may pair with any tribe surname
const ENGLISH_FIRST = [
  "Emmanuel", "Blessing", "Grace", "Victor", "Daniel", "Faith", "Miracle", "Precious", "David", "Samuel",
  "Joseph", "Esther", "Ruth", "Stephen", "Philip", "John", "Mary", "Elizabeth", "Peter", "Paul",
  "James", "Mercy", "Charity", "Hope", "Love", "Solomon", "Ezekiel", "Moses", "Caleb", "Joshua",
  "Deborah", "Rebecca", "Naomi", "Hannah", "Abigail", "Nathaniel", "Timothy", "Michael", "Gabriel",
  "Raphael", "Benedict", "Theresa", "Christina", "Patricia", "Florence", "Cynthia", "Angela",
];

// ALL surnames pool (for English-name cross-pairing)
const ALL_LAST = [
  ...IGBO_LAST, ...YORUBA_LAST, ...HAUSA_LAST, ...FULANI_LAST,
  ...IJAW_LAST, ...EFIK_LAST, ...IBIBIO_LAST, ...TIV_LAST,
  ...EDO_LAST, ...URHOBO_LAST, ...ISOKO_LAST, ...ITSEKIRI_LAST,
  ...NUPE_LAST, ...KANURI_LAST, ...IGALA_LAST, ...EBIRA_LAST,
  ...IDOMA_LAST, ...OGONI_LAST, ...IKWERRE_LAST, ...ANNANG_LAST, ...JUKUN_LAST,
];

// Tribe groups with probability weights (total = 1.0)
// Igbo 22%, Yoruba 22%, Hausa 15%, Fulani 5%, Ijaw 6%,
// Efik 4%, Ibibio 4%, Tiv 4%, Edo 4%, Urhobo 3%,
// Isoko 1%, Itsekiri 1%, Nupe 1%, Kanuri 1%, Igala 1%,
// Ebira 1%, Idoma 1%, Ogoni 1%, Ikwerre 1%, Annang 0.5%, Jukun 0.5%, English 1%
const TRIBE_POOL: Array<{ first: string[]; last: string[]; weight: number }> = [
  { first: IGBO_FIRST,     last: IGBO_LAST,     weight: 0.22 },
  { first: YORUBA_FIRST,   last: YORUBA_LAST,   weight: 0.22 },
  { first: HAUSA_FIRST,    last: HAUSA_LAST,    weight: 0.15 },
  { first: FULANI_FIRST,   last: FULANI_LAST,   weight: 0.05 },
  { first: IJAW_FIRST,     last: IJAW_LAST,     weight: 0.06 },
  { first: EFIK_FIRST,     last: EFIK_LAST,     weight: 0.04 },
  { first: IBIBIO_FIRST,   last: IBIBIO_LAST,   weight: 0.04 },
  { first: TIV_FIRST,      last: TIV_LAST,      weight: 0.04 },
  { first: EDO_FIRST,      last: EDO_LAST,      weight: 0.04 },
  { first: URHOBO_FIRST,   last: URHOBO_LAST,   weight: 0.03 },
  { first: ISOKO_FIRST,    last: ISOKO_LAST,    weight: 0.01 },
  { first: ITSEKIRI_FIRST, last: ITSEKIRI_LAST, weight: 0.01 },
  { first: NUPE_FIRST,     last: NUPE_LAST,     weight: 0.01 },
  { first: KANURI_FIRST,   last: KANURI_LAST,   weight: 0.01 },
  { first: IGALA_FIRST,    last: IGALA_LAST,    weight: 0.01 },
  { first: EBIRA_FIRST,    last: EBIRA_LAST,    weight: 0.01 },
  { first: IDOMA_FIRST,    last: IDOMA_LAST,    weight: 0.01 },
  { first: OGONI_FIRST,    last: OGONI_LAST,    weight: 0.01 },
  { first: IKWERRE_FIRST,  last: IKWERRE_LAST,  weight: 0.01 },
  { first: ANNANG_FIRST,   last: ANNANG_LAST,   weight: 0.005 },
  { first: JUKUN_FIRST,    last: JUKUN_LAST,    weight: 0.005 },
];

const pickWriter = (): string => {
  // English names get cross-tribe surname (last 1% bucket)
  if (Math.random() > 0.99) {
    const f = ENGLISH_FIRST[Math.floor(Math.random() * ENGLISH_FIRST.length)];
    const l = ALL_LAST[Math.floor(Math.random() * ALL_LAST.length)];
    return `${f} ${l}`;
  }
  // Weighted tribe selection
  let roll = Math.random();
  for (const tribe of TRIBE_POOL) {
    roll -= tribe.weight;
    if (roll <= 0) {
      const f = tribe.first[Math.floor(Math.random() * tribe.first.length)];
      const l = tribe.last[Math.floor(Math.random() * tribe.last.length)];
      return `${f} ${l}`;
    }
  }
  // Fallback (floating point rounding)
  const t = TRIBE_POOL[0];
  return `${t.first[Math.floor(Math.random() * t.first.length)]} ${t.last[Math.floor(Math.random() * t.last.length)]}`;
};


const levelBadge = (lvl: string) =>
  lvl === 'PhD' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    : lvl === 'MSc' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

export default function ProjectsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [depts, setDepts] = useState<{ department: string; count: number }[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [dept, setDept] = useState('all');
  const [level, setLevel] = useState('all');

  const [preview, setPreview] = useState<Topic | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Set<number>>(new Set());
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  // Writer match simulation states
  const [simulationState, setSimulationState] = useState<'searching' | 'bidding' | 'awarding' | 'complete' | 'idle'>('idle');
  const [availableWriters, setAvailableWriters] = useState(0);
  const [biddingWriters, setBiddingWriters] = useState(0);
  const [assignedWriter, setAssignedWriter] = useState('');

  useEffect(() => {
    if (cart) {
      setSimulationState('searching');
      setAssignedWriter('');
      
      const t1 = setTimeout(() => {
        const avail = Math.floor(Math.random() * 10) + 12; // 12 to 21 available
        const bid = Math.floor(Math.random() * 5) + 6; // 6 to 10 bidding
        setAvailableWriters(avail);
        setBiddingWriters(Math.min(bid, avail - 2));
        setSimulationState('bidding');
        
        const t2 = setTimeout(() => {
          setSimulationState('awarding');
          
          const t3 = setTimeout(() => {
            setAssignedWriter(pickWriter());
            setSimulationState('complete');
          }, 1600); // 1.6s delay representing awarding selection
          
          return () => clearTimeout(t3);
        }, 1500); // 1.5s delay showing bid count
        
        return () => clearTimeout(t2);
      }, 1600); // 1.6s searching spinner
      
      return () => {
        clearTimeout(t1);
      };
    } else {
      setSimulationState('idle');
    }
  }, [cart]);

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customLevel, setCustomLevel] = useState('BSc');
  const [customDept, setCustomDept] = useState('General');
  const [customCard, setCustomCard] = useState<{ title: string; level: string; department: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Search states
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedSearchDept, setSelectedSearchDept] = useState('all');
  const [selectedSearchLevel, setSelectedSearchLevel] = useState('all');

  const [sessionSeed, setSessionSeed] = useState(() => Math.random());
  const [levelPrices, setLevelPrices] = useState<Record<string, number>>({ BSc: 3999, MSc: 4500, PhD: 10000 });
  const [deptPrices, setDeptPrices] = useState<Record<string, number>>({});
  const [pageSettings, setPageSettings] = useState<any>({
    hero_title: "Project Topics & Research Materials",
    hero_description: "Thousands of ready-made materials across every Nigerian department — full Chapters 1–5, in MS Word, delivered to your secure vault.",
    features: ["📖 Chapters 1–5", "🕗 Working hours 8am–7pm", "⚡ 4-hour delivery"],
    disclaimer_text: "Please note: these are ready-made materials — we do not check or guarantee plagiarism/similarity or AI-detection levels on them. Purchasing simply means the project will be delivered as-is. Need a plagiarism-free, AI-free custom write-up? Use our main writing service →",
    checkout_terms: "I understand this is a ready-made material — similarity/plagiarism and AI-detection levels are not checked or guaranteed. My purchase means the project will be delivered (Chapters 1–5, MS Word) to my vault. Working hours are 8am–7pm; delivery is within 4 hours.",
    delivery_text: "⚡ Delivered within 4 hours",
    show_random: true
  });

  const [addonWords, setAddonWords] = useState<Record<number, number>>({});
  const [addonFeatures, setAddonFeatures] = useState<Record<number, string[]>>({});
  const [customLocation, setCustomLocation] = useState('');

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const slugify = (title: string) =>
    title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
  const copyPermalink = (topicId: number, title: string) => {
    const link = `${window.location.origin}/projects/${topicId}-${slugify(title)}`;
    navigator.clipboard.writeText(link);
    setCopiedId(topicId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const mergedDepts = useCallback(() => {
    const dbDepts = depts.map(d => d.department);
    const set = new Set([...dbDepts, ...NIGERIAN_DEPARTMENTS]);
    return Array.from(set).sort();
  }, [depts])();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);

      // Load settings
      const { data: settingsData } = await supabase.from('project_settings').select('*');
      if (settingsData) {
        let lp = { BSc: 3999, MSc: 4500, PhD: 10000 };
        let dp = {};
        let ps = { ...pageSettings };
        settingsData.forEach(s => {
          if (s.key === 'level_prices') lp = s.value;
          if (s.key === 'department_prices') dp = s.value;
          if (s.key === 'page_settings') ps = { ...ps, ...s.value };
        });
        setLevelPrices(lp);
        setDeptPrices(dp);
        setPageSettings(ps);
      }

      const [{ data: d }, { data: a }] = await Promise.all([
        supabase.from('project_topic_departments').select('*'),
        supabase.from('project_addons').select('id, name, description, price, price_type, features, is_location_changer').eq('is_active', true).order('sort_order'),
      ]);
      setDepts((d as any[]) || []);
      setAddons((a as Addon[]) || []);
    })();
  }, []);

  // Compute pricing fallback
  const getTopicPrice = useCallback((lvl: string, deptName: string, customPrice?: number) => {
    if (customPrice !== undefined && Number(customPrice) > 0) return Number(customPrice);
    const deptPrice = deptPrices[deptName];
    if (deptPrice !== undefined && Number(deptPrice) > 0) return Number(deptPrice);
    return levelPrices[lvl] || levelPrices.BSc || 3999;
  }, [levelPrices, deptPrices]);

  const fetchTopics = useCallback(async (targetPage: number, seedOverride?: number) => {
    const from = (targetPage - 1) * PAGE_SIZE;

    // Get count first
    let countQuery = supabase.from('project_topics').select('*', { count: 'exact', head: true }).eq('is_active', true);
    if (dept !== 'all') countQuery = countQuery.eq('department', dept);
    if (level !== 'all') countQuery = countQuery.eq('level', level);
    if (debounced.trim()) countQuery = countQuery.ilike('title', `%${debounced.trim()}%`);
    const { count } = await countQuery;
    setTotal(count || 0);

    let data: Topic[] | null = null;
    let error: any = null;

    if (pageSettings.show_random) {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_project_topics_random', {
        p_seed: seedOverride ?? sessionSeed,
        p_dept: dept,
        p_level: level,
        p_search: debounced.trim(),
        p_limit: PAGE_SIZE,
        p_offset: from
      });
      data = rpcData;
      error = rpcError;
    }

    // Fallback if rpc is not found or fails
    if (!data || error) {
      let q = supabase.from('project_topics').select('*').eq('is_active', true);
      if (dept !== 'all') q = q.eq('department', dept);
      if (level !== 'all') q = q.eq('level', level);
      if (debounced.trim()) q = q.ilike('title', `%${debounced.trim()}%`);
      q = q.order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);
      const { data: selectData } = await q;
      data = selectData as Topic[];
    }

    // Map dynamic prices onto the topics
    const mapped = (data || []).map(t => ({
      ...t,
      price: getTopicPrice(t.level, t.department, t.price)
    }));

    setTopics(mapped);
    setPage(targetPage);
  }, [dept, level, debounced, sessionSeed, pageSettings.show_random, getTopicPrice]);

  const handlePageChange = (p: number) => {
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (p < 1 || p > totalPages) return;
    setLoading(true);
    fetchTopics(p).finally(() => {
      setLoading(false);
      document.getElementById('topics-grid')?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const executeAvailabilitySearch = async () => {
    if (!search.trim()) return;
    setIsSearching(true);
    setMsg('');
    
    // Sync filter state
    setDept(selectedSearchDept);
    setLevel(selectedSearchLevel);
    
    // Simulated loading delay for premium feel
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      setDebounced(search.trim());
      setHasSearched(true);
    } catch (err) {
      console.error(err);
      setMsg('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchTopics(1).finally(() => setLoading(false));
  }, [dept, level, debounced, hasSearched]);

  // ---- checkout ----
  const openCart = (c: Cart) => {
    setPreview(null);
    setSelectedAddons(new Set());
    setAddonWords({});
    setAddonFeatures({});
    setCustomLocation('');
    setAcceptedTerms(false);
    setMsg('');
    setCart(c);
  };

  const cartTotal = () => {
    if (!cart) return 0;
    let t = cart.basePrice;
    addons.forEach(a => {
      if (selectedAddons.has(a.id)) {
        if (a.price_type === 'per_word') {
          const w = addonWords[a.id] || 1000;
          t += Number(a.price) * w;
        } else {
          t += Number(a.price);
        }

        // Add features
        if (Array.isArray(a.features) && addonFeatures[a.id]) {
          a.features.forEach(f => {
            if (addonFeatures[a.id].includes(f.name)) {
              t += Number(f.price);
            }
          });
        }
      }
    });
    return Math.round(t);
  };

  const pay = async () => {
    if (!cart || !acceptedTerms) return;
    if (isLoggedIn === false && !EMAIL_RE.test(guestEmail.trim())) {
      setMsg('Please enter a valid email — your receipt and vault access link go there.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/projects/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: cart.topicId,
          customTitle: cart.customTitle,
          department: cart.department,
          level: cart.level,
          addonIds: Array.from(selectedAddons),
          addonWords: addonWords,
          addonFeatures: addonFeatures,
          customLocation: customLocation,
          assignedWriter: assignedWriter || undefined,
          email: isLoggedIn === false ? guestEmail.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.authorization_url) window.location.href = data.authorization_url;
      else setMsg(data.error || 'Could not start checkout.');
    } catch { setMsg('Network error. Please try again.'); }
    setBusy(false);
  };

  const checkCustomAvailability = () => {
    if (customTitle.trim().length < 5) { setMsg('Please enter a fuller topic title.'); return; }
    setMsg('');
    setCustomCard({ title: customTitle.trim(), level: customLevel, department: customDept });
    // Reshuffle the catalogue behind it too, same as a full page reload.
    const newSeed = Math.random();
    setSessionSeed(newSeed);
    fetchTopics(page, newSeed);
  };

  // Title difference highlighters for similar searches
  const renderTitleWithDifferences = (title: string) => {
    const cleanWords = (t: string) =>
      t.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .split(/\s+/)
        .filter(Boolean);

    const words = cleanWords(title);
    const wordsSet = new Set(words);
    if (words.length === 0) return title;

    let bestMatchTitle = "";
    let bestOverlap = 0;

    topics.forEach(other => {
      if (other.title === title) return;
      const otherWords = cleanWords(other.title);
      if (otherWords.length === 0) return;
      const common = otherWords.filter(w => wordsSet.has(w));
      const overlap = common.length / Math.max(words.length, otherWords.length);
      if (overlap > bestOverlap && overlap > 0.45 && overlap < 0.98) {
        bestOverlap = overlap;
        bestMatchTitle = other.title;
      }
    });

    if (bestOverlap > 0.45 && bestMatchTitle) {
      const otherWordsSet = new Set(cleanWords(bestMatchTitle));
      const tokens = title.split(/(\s+)/);
      return tokens.map((token, idx) => {
        const cleanToken = token.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
        if (cleanToken && !otherWordsSet.has(cleanToken)) {
          return (
            <span key={idx} className="text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/25 font-extrabold shadow-sm text-xs select-none">
              {token}
            </span>
          );
        }
        return token;
      });
    }
    return title;
  };

  return (
    <div className="min-h-screen bg-primary text-primary font-['Inter']">
      <Header projectsContext />
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-800 text-white">
        <div className="absolute -top-16 -right-20 w-72 h-72 rounded-full bg-white/5 animate-blob" />
        <div className="absolute -bottom-24 -left-16 w-96 h-96 rounded-full bg-white/[0.03] animate-blob animation-delay-2000" />
        <div className="relative z-10 max-w-4xl mx-auto text-center px-4 sm:px-6 pt-header-24 sm:pt-header-28 pb-12">
          <div className="text-5xl mb-2">📚</div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
            {pageSettings.hero_title}
          </h1>
          <p className="text-sm md:text-base opacity-90 max-w-2xl mx-auto">
            {pageSettings.hero_description}
          </p>
          <div className="flex gap-2 justify-center flex-wrap mt-5 text-xs font-bold">
            {Array.isArray(pageSettings.features) && pageSettings.features.map((f: string, i: number) => (
              <span key={i} className="bg-white/15 px-4 py-1.5 rounded-full">{f}</span>
            ))}
            <span className="bg-white/15 px-4 py-1.5 rounded-full">
              BSc {naira(levelPrices.BSc)} · MSc {naira(levelPrices.MSc)} · PhD {naira(levelPrices.PhD)}
            </span>
          </div>

          {/* DATABASE SEARCH CARD MOVED HERE */}
          {!hasSearched && !isSearching ? (
            <div className="max-w-2xl mx-auto mt-6 text-left">
              <div className="rounded-[28px] sm:rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6 text-center bg-white/10 backdrop-blur-xl border border-white/15 text-primary">
                <div>
                  <h2 className="text-xl font-black text-primary">Database Search & Availability</h2>
                  <p className="text-xs text-secondary mt-1.5 leading-relaxed font-semibold">
                    Place your full project topic below to search our database of 3,000+ completed projects and check instant availability.
                  </p>
                </div>

                <div className="space-y-4 text-left">
                  <div>
                    <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Your Full Project Topic *</label>
                    <textarea
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="e.g. Challenges and prospects of financial autonomy to local government administration..."
                      rows={3}
                      className="w-full bg-secondary border border-theme rounded-xl p-4 text-sm text-primary focus:border-emerald-500 outline-none transition font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Department</label>
                      <select
                        value={selectedSearchDept}
                        onChange={e => setSelectedSearchDept(e.target.value)}
                        className="w-full bg-secondary border border-theme rounded-xl p-3.5 text-sm text-primary outline-none focus:border-emerald-500 font-bold cursor-pointer"
                      >
                        <option value="all">📂 All Departments</option>
                        {mergedDepts.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Academic Level</label>
                      <select
                        value={selectedSearchLevel}
                        onChange={e => setSelectedSearchLevel(e.target.value)}
                        className="w-full bg-secondary border border-theme rounded-xl p-3.5 text-sm text-primary outline-none focus:border-emerald-500 font-bold cursor-pointer"
                      >
                        <option value="all">🎓 All Levels</option>
                        <option value="BSc">BSc / HND</option>
                        <option value="MSc">MSc / PGD</option>
                        <option value="PhD">PhD</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={executeAvailabilitySearch}
                    disabled={!search.trim() || isSearching}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-xs tracking-widest rounded-xl transition shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                  >
                    Check Availability & Retrieve Material
                  </button>
                </div>
              </div>
            </div>
          ) : hasSearched && !isSearching ? (
            loading ? (
              <div className="max-w-md mx-auto mt-6 py-10 text-center space-y-6 bg-card border border-theme rounded-3xl p-8 shadow-2xl">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                  <div className="absolute inset-2 rounded-full border-4 border-indigo-500/20 border-b-indigo-500 animate-spin [animation-direction:reverse]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-primary">Loading matching topics...</h3>
                </div>
              </div>
            ) : topics.length === 0 ? (
              /* NO DIRECT RESULTS - SHOW CUSTOM WRITEUP CARD HERE IN HERO */
              <div className="max-w-2xl mx-auto mt-6 rounded-3xl p-4 sm:p-8 space-y-6 text-center shadow-2xl bg-card border border-theme text-primary">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-theme/25 pb-4 text-left">
                  <div>
                    <h3 className="text-sm font-bold text-primary">Search Results</h3>
                    <p className="text-xs text-secondary mt-0.5">Availability results for: <span className="text-primary italic font-bold">"{search}"</span></p>
                  </div>
                  <button 
                    onClick={() => { setHasSearched(false); setIsSearching(false); setTopics([]); setCustomCard(null); }}
                    className="px-4 py-2 bg-secondary border border-theme hover:bg-white/5 text-primary text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 self-start sm:self-auto"
                  >
                    <lucide.Search className="w-3.5 h-3.5" /> Search Another Topic
                  </button>
                </div>

                <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                  <lucide.CheckCircle className="w-7 h-7 text-emerald-500" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-primary">Custom Write-up Available!</h4>
                  <p className="text-xs text-secondary mt-1.5 leading-relaxed max-w-md mx-auto font-semibold">
                    Our writers can prepare your custom topic as an original project with complete Chapters 1–5, structured layout, and full references.
                  </p>
                </div>

                <div className="bg-secondary/40 border border-theme p-4 sm:p-6 rounded-2xl text-left space-y-4 max-w-lg mx-auto">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500 text-black">✓ Available</span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border border-theme text-primary">{selectedSearchLevel === 'all' ? 'BSc' : selectedSearchLevel}</span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white/5 text-purple-400">{selectedSearchDept === 'all' ? 'General' : selectedSearchDept}</span>
                  </div>
                  <p className="text-xs font-bold text-primary leading-normal break-words">{search}</p>
                  <div className="border-t border-theme/40 pt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                      <span className="text-[10px] text-secondary uppercase font-black block">Standard Cost</span>
                      <span className="text-sm font-mono font-bold text-emerald-500">{naira(getTopicPrice(selectedSearchLevel === 'all' ? 'BSc' : selectedSearchLevel, selectedSearchDept === 'all' ? 'General' : selectedSearchDept))}</span>
                    </div>
                    <button 
                      onClick={() => openCart({ 
                        customTitle: search.trim(), 
                        level: selectedSearchLevel === 'all' ? 'BSc' : selectedSearchLevel, 
                        department: selectedSearchDept === 'all' ? 'General' : selectedSearchDept, 
                        title: search.trim(), 
                        basePrice: getTopicPrice(selectedSearchLevel === 'all' ? 'BSc' : selectedSearchLevel, selectedSearchDept === 'all' ? 'General' : selectedSearchDept) 
                      })} 
                      className="w-full sm:w-auto bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition cursor-pointer"
                    >
                      Order Custom Write-up
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* DIRECT MATCHES FOUND - SHOW THE COMPACT SEARCH RESULTS BANNER */
              <div className="max-w-2xl mx-auto mt-6 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 text-left text-primary bg-card border border-theme">
                <div>
                  <h3 className="text-sm font-bold text-primary">Search Results</h3>
                  <p className="text-xs text-secondary mt-0.5">Availability results for: <span className="text-primary italic font-bold">"{search}"</span></p>
                </div>
                <button
                  onClick={() => { setHasSearched(false); setIsSearching(false); setTopics([]); setCustomCard(null); }}
                  className="px-4 py-2 bg-secondary border border-theme hover:bg-white/5 text-primary text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 self-start sm:self-auto"
                >
                  <lucide.Search className="w-3.5 h-3.5" /> Search Another Topic
                </button>
              </div>
            )
          ) : isSearching ? (
            <div className="max-w-md mx-auto mt-10 py-10 text-center space-y-6 bg-card border border-theme rounded-3xl p-8 shadow-2xl">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                <div className="absolute inset-2 rounded-full border-4 border-indigo-500/20 border-b-indigo-500 animate-spin [animation-direction:reverse]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-primary">Scanning Project Database...</h3>
                <p className="text-xs text-secondary mt-1">Checking chapters, tables, and references availability for your topic.</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* SERVICES (project-topics specific) */}
      <section id="services" className="px-4 md:px-6 py-10 border-b border-theme">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-lg md:text-xl font-black text-primary text-center mb-6">What's Included With Every Topic</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-panel rounded-2xl p-5 text-center hover:-translate-y-1 transition-transform duration-300">
              <div className="text-2xl mb-2">📚</div>
              <h3 className="text-sm font-bold text-primary mb-1">Ready-made Chapters 1–5</h3>
              <p className="text-xs text-secondary">Full academic material in MS Word, matched to your department and level.</p>
            </div>
            <div className="glass-panel rounded-2xl p-5 text-center hover:-translate-y-1 transition-transform duration-300">
              <div className="text-2xl mb-2">🧩</div>
              <h3 className="text-sm font-bold text-primary mb-1">Optional Add-ons</h3>
              <p className="text-xs text-secondary">Extend any topic with extras like SPSS analysis, PowerPoint slides, or a location/case-study change.</p>
            </div>
            <div className="glass-panel rounded-2xl p-5 text-center hover:-translate-y-1 transition-transform duration-300">
              <div className="text-2xl mb-2">🔒</div>
              <h3 className="text-sm font-bold text-primary mb-1">Secure Vault Delivery</h3>
              <p className="text-xs text-secondary">Your material lands in your dashboard's Secure Vault, ready to download.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS (project-topics specific) */}
      <section id="how-it-works" className="px-4 md:px-6 py-10 border-b border-theme bg-secondary/20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-lg md:text-xl font-black text-primary text-center mb-6">How It Works</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { n: '1', label: 'Pick a Topic', desc: 'Browse or search 3,000+ ready-made topics.' },
              { n: '2', label: 'Choose Add-ons', desc: 'Extend it with optional extras if you need them.' },
              { n: '3', label: 'Pay Securely', desc: 'Checkout with card — no account required upfront.' },
              { n: '4', label: 'Get Delivered', desc: 'Material lands in your Secure Vault within hours.' },
            ].map(step => (
              <div key={step.n} className="text-center">
                <div className="w-9 h-9 mx-auto mb-2 rounded-full bg-emerald-500 text-black font-black flex items-center justify-center text-sm">{step.n}</div>
                <h4 className="text-xs font-bold text-primary mb-1">{step.label}</h4>
                <p className="text-[11px] text-secondary leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DISCLAIMER */}
      <div className="bg-amber-400/10 border-b border-amber-400/30 px-4 md:px-6 py-3">
        <div className="max-w-5xl mx-auto text-xs md:text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
          <lucide.AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            {pageSettings.disclaimer_text.includes("Use our main writing service") ? (
              <>
                <strong>Please note:</strong> these are ready-made materials — we do <strong>not</strong> check or guarantee plagiarism/similarity or AI-detection levels on them. Purchasing simply means the project <strong>will be delivered</strong> as-is. Need a <strong>plagiarism-free, AI-free</strong> custom write-up? {' '}
                <Link href="/order/academic" className="underline font-bold">Use our main writing service →</Link>
              </>
            ) : pageSettings.disclaimer_text}
          </p>
        </div>
      </div>

      {/* DATABASE SEARCH & AVAILABILITY RESULTS CONTAINER */}
      {hasSearched && !isSearching && !loading && topics.length > 0 && (
        <div className="max-w-[1320px] mx-auto px-4 py-8">
          <div className="flex justify-between items-center gap-4 border-b border-theme pb-4">
            <div>
              <h3 className="text-lg font-bold text-primary">Matching Database Topics</h3>
              <p className="text-xs text-secondary mt-0.5">Availability results for: <span className="text-primary italic font-bold">"{search}"</span></p>
            </div>
            <button 
              onClick={() => { setHasSearched(false); setIsSearching(false); setTopics([]); setCustomCard(null); }}
              className="px-4 py-2 bg-secondary border border-theme hover:bg-white/5 text-primary text-xs font-bold rounded-xl transition cursor-pointer"
            >
              🔎 Search Another Topic
            </button>
          </div>

          {msg && !cart && <div className="mb-4 text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{msg}</div>}

          <div id="topics-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {topics.map(t => (
              <div key={t.id} className="glass-panel rounded-[24px] p-5 flex flex-col gap-3 hover:border-emerald-500/40 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">{t.department}</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${levelBadge(t.level)}`}>{t.level}</span>
                </div>
                <h3 className="text-sm font-bold leading-relaxed text-primary line-clamp-3">
                  {renderTitleWithDifferences(t.title)}
                </h3>
                <div className="flex gap-x-3 gap-y-1 flex-wrap text-[11px] text-secondary font-mono">
                  <span>📄 {t.pages || '—'} pages</span><span>📖 Ch. {t.chapters}</span><span>📅 {t.year}</span><span>📝 {t.format}</span>
                </div>
                <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1 w-fit">{pageSettings.delivery_text}</span>
                <div className="flex gap-2 mt-auto pt-1 flex-wrap">
                  <button onClick={() => setPreview(t)} className="flex-1 py-2.5 rounded-lg text-xs font-bold border border-theme bg-secondary hover:bg-white/5 text-primary transition min-w-[70px]">👁 Preview</button>
                  <button onClick={() => copyPermalink(t.id, t.title)} className="px-3 py-2.5 rounded-lg text-xs font-bold border border-theme bg-secondary hover:bg-white/5 text-primary transition whitespace-nowrap">
                    {copiedId === t.id ? '✓ Copied' : '🔗 Share'}
                  </button>
                  <button onClick={() => openCart({ topicId: t.id, department: t.department, level: t.level, title: t.title, basePrice: Number(t.price) })} className="flex-1 py-2.5 rounded-lg text-xs font-black bg-amber-400 hover:bg-amber-300 text-emerald-950 transition min-w-[90px]">Get · {naira(t.price)}</button>
                </div>
              </div>
            ))}
          </div>

          {/* PAGINATION BAR */}
          {Math.ceil(total / PAGE_SIZE) > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
              <button
                disabled={page === 1 || loading}
                onClick={() => handlePageChange(page - 1)}
                className="px-4 py-2 rounded-xl bg-secondary border border-theme text-primary text-xs font-bold hover:bg-white/5 disabled:opacity-40 transition"
              >
                ◀ Prev
              </button>
              
              {Array.from({ length: Math.min(5, Math.ceil(total / PAGE_SIZE)) }, (_, i) => {
                const totalPages = Math.ceil(total / PAGE_SIZE);
                let pageNum = page - 2 + i;
                if (page <= 2) pageNum = i + 1;
                if (page >= totalPages - 1) pageNum = totalPages - 4 + i;
                pageNum = Math.max(1, Math.min(pageNum, totalPages));
                
                if (pageNum < 1 || pageNum > totalPages) return null;
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-9 h-9 rounded-xl text-xs font-bold transition ${page === pageNum ? 'bg-emerald-500 text-black' : 'bg-secondary border border-theme text-primary hover:bg-white/5'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              <button
                disabled={page === Math.ceil(total / PAGE_SIZE) || loading}
                onClick={() => handlePageChange(page + 1)}
                className="px-4 py-2 rounded-xl bg-secondary border border-theme text-primary text-xs font-bold hover:bg-white/5 disabled:opacity-40 transition"
              >
                Next ▶
              </button>
            </div>
          )}
        </div>
      )}

      {/* BROWSE ALL PROJECT TOPICS (below search section) */}
      {!hasSearched && !isSearching && (
        <div className="max-w-[1320px] mx-auto px-4 pb-16">
          {/* Filter Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-lg font-black text-primary">Browse Available Topics</h2>
              <p className="text-xs text-secondary mt-0.5">
                {total > 0 ? `${total.toLocaleString()} topics in our database` : 'Loading topics…'}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={dept}
                onChange={e => { setDept(e.target.value); setPage(1); }}
                className="bg-secondary border border-theme rounded-xl px-3 py-2 text-xs text-primary font-bold outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">📂 All Departments</option>
                {mergedDepts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                value={level}
                onChange={e => { setLevel(e.target.value); setPage(1); }}
                className="bg-secondary border border-theme rounded-xl px-3 py-2 text-xs text-primary font-bold outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">🎓 All Levels</option>
                <option value="BSc">BSc / HND</option>
                <option value="MSc">MSc / PGD</option>
                <option value="PhD">PhD</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-secondary text-sm flex items-center justify-center gap-2">
              <lucide.Loader2 className="w-4 h-4 animate-spin" /> Loading topics…
            </div>
          ) : topics.length === 0 ? (
            <div className="py-20 text-center text-secondary text-sm">No topics found for this filter. Try a different department or level.</div>
          ) : (
            <>
              <div id="topics-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topics.map(t => (
                  <div key={t.id} className="glass-panel rounded-[24px] p-5 flex flex-col gap-3 hover:border-emerald-500/40 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">{t.department}</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${levelBadge(t.level)}`}>{t.level}</span>
                    </div>
                    <h3 className="text-sm font-bold leading-relaxed text-primary line-clamp-3">
                      {renderTitleWithDifferences(t.title)}
                    </h3>
                    <div className="flex gap-x-3 gap-y-1 flex-wrap text-[11px] text-secondary font-mono">
                      <span>📄 {t.pages || '—'} pages</span><span>📖 Ch. {t.chapters}</span><span>📅 {t.year}</span><span>📝 {t.format}</span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1 w-fit">{pageSettings.delivery_text}</span>
                    <div className="flex gap-2 mt-auto pt-1 flex-wrap">
                      <button onClick={() => setPreview(t)} className="flex-1 py-2.5 rounded-lg text-xs font-bold border border-theme bg-secondary hover:bg-white/5 text-primary transition min-w-[70px]">👁 Preview</button>
                      <button onClick={() => copyPermalink(t.id, t.title)} className="px-3 py-2.5 rounded-lg text-xs font-bold border border-theme bg-secondary hover:bg-white/5 text-primary transition whitespace-nowrap">
                        {copiedId === t.id ? '✓ Copied' : '🔗 Share'}
                      </button>
                      <button onClick={() => openCart({ topicId: t.id, department: t.department, level: t.level, title: t.title, basePrice: Number(t.price) })} className="flex-1 py-2.5 rounded-lg text-xs font-black bg-amber-400 hover:bg-amber-300 text-emerald-950 transition min-w-[90px]">Get · {naira(t.price)}</button>
                    </div>
                  </div>
                ))}
              </div>

              {Math.ceil(total / PAGE_SIZE) > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
                  <button
                    disabled={page === 1 || loading}
                    onClick={() => handlePageChange(page - 1)}
                    className="px-4 py-2 rounded-xl bg-secondary border border-theme text-primary text-xs font-bold hover:bg-white/5 disabled:opacity-40 transition"
                  >◀ Prev</button>
                  {Array.from({ length: Math.min(5, Math.ceil(total / PAGE_SIZE)) }, (_, i) => {
                    const totalPages = Math.ceil(total / PAGE_SIZE);
                    let p: number;
                    if (totalPages <= 5) { p = i + 1; }
                    else if (page <= 3) { p = i + 1; }
                    else if (page >= totalPages - 2) { p = totalPages - 4 + i; }
                    else { p = page - 2 + i; }
                    return (
                      <button key={p} onClick={() => handlePageChange(p)}
                        className={`px-4 py-2 rounded-xl border text-xs font-bold transition ${p === page ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-secondary border-theme text-primary hover:bg-white/5'}`}
                      >{p}</button>
                    );
                  })}
                  <button
                    disabled={page === Math.ceil(total / PAGE_SIZE) || loading}
                    onClick={() => handlePageChange(page + 1)}
                    className="px-4 py-2 rounded-xl bg-secondary border border-theme text-primary text-xs font-bold hover:bg-white/5 disabled:opacity-40 transition"
                  >Next ▶</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* PREVIEW MODAL */}

      {preview && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-card border border-theme rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">{preview.department}</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${levelBadge(preview.level)}`}>{preview.level}</span>
                </div>
                <button onClick={() => setPreview(null)} className="text-secondary hover:text-primary"><lucide.X className="w-5 h-5" /></button>
              </div>
              <h2 className="text-lg font-black text-primary leading-snug mb-3">{preview.title}</h2>
              <p className="text-sm text-secondary leading-relaxed mb-4">{preview.description}</p>
              <div className="grid grid-cols-2 gap-3 bg-secondary border border-theme rounded-xl p-4 mb-4 text-sm">
                <div><span className="block text-[10px] uppercase text-secondary font-bold">Pages</span>{preview.pages || '—'}</div>
                <div><span className="block text-[10px] uppercase text-secondary font-bold">Chapters</span>{preview.chapters}</div>
                <div><span className="block text-[10px] uppercase text-secondary font-bold">Format</span>{preview.format}</div>
                <div><span className="block text-[10px] uppercase text-secondary font-bold">Year</span>{preview.year}</div>
              </div>
              <button onClick={() => openCart({ topicId: preview.id, department: preview.department, level: preview.level, title: preview.title, basePrice: getTopicPrice(preview.level, preview.department || 'General', Number(preview.price)) })} className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black transition">
                💳 Get Complete Material — {naira(getTopicPrice(preview.level, preview.department || 'General', Number(preview.price)))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL (add-ons + terms) */}
      {cart && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4" onClick={() => !busy && setCart(null)}>
          <div className="bg-card border border-theme rounded-2xl max-w-lg w-full max-h-[88vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <h2 className="text-lg font-black text-primary">Complete Your Purchase</h2>
                <button onClick={() => setCart(null)} className="text-secondary hover:text-primary"><lucide.X className="w-5 h-5" /></button>
              </div>
              <div className="bg-secondary border border-theme rounded-xl p-4">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${levelBadge(cart.level)}`}>{cart.level}</span>
                <p className="text-sm font-bold text-primary mt-2">{cart.title}</p>
                <p className="text-[11px] text-secondary">Chapters 1–5 · MS Word · {naira(cart.basePrice)}</p>
                <p className="text-[11px] font-bold text-amber-500 mt-1">{pageSettings.delivery_text}</p>
              </div>

              {/* Writer Assignment Simulation Panel */}
              <div className="bg-secondary/40 border border-theme rounded-2xl p-4 space-y-3 relative overflow-hidden">
                {simulationState === 'searching' && (
                  <div className="flex items-center gap-3 py-1">
                    <div className="w-4 h-4 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin shrink-0" />
                    <span className="text-secondary text-xs font-bold">Searching for available writers for your work...</span>
                  </div>
                )}
                {simulationState === 'bidding' && (
                  <div className="space-y-1 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-black">
                      <lucide.Users className="w-4 h-4" />
                      <span>Writer Search Complete</span>
                    </div>
                    <p className="text-secondary text-xs leading-relaxed font-semibold">
                      <strong className="text-primary font-black">{availableWriters}</strong> writers are available, and <strong className="text-primary font-black">{biddingWriters}</strong> are actively bidding to write your work.
                    </p>
                  </div>
                )}
                {simulationState === 'awarding' && (
                  <div className="flex items-center gap-3 py-1">
                    <div className="w-4 h-4 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin shrink-0" />
                    <span className="text-secondary text-xs font-bold">We are choosing the best writer for the job...</span>
                  </div>
                )}
                {simulationState === 'complete' && (
                  <div className="space-y-1.5 border-l-4 border-emerald-500 pl-3 animate-in slide-in-from-left duration-300">
                    <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                      <lucide.CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Writer Standby Secured</span>
                    </div>
                    <p className="text-primary text-xs font-bold">
                      Assigned Writer: <span className="underline decoration-emerald-500 decoration-2">{assignedWriter}</span>
                    </p>
                    <p className="text-[11px] text-secondary leading-relaxed font-semibold">
                      This writer is on standby to write your work for the next 6 hours. Proceed to pay to lock in this writer.
                    </p>
                  </div>
                )}
              </div>

              {isLoggedIn === false && (
                <div>
                  <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Your Email (for receipt & vault access)</label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-secondary border border-theme rounded-xl px-3 py-2.5 text-sm text-primary outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-secondary mt-1 font-semibold">An account will be created automatically using your email as your temporary password. You can change this later from your Profile.</p>
                </div>
              )}

              {addons.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase font-black text-secondary mb-2">Optional Add-ons</p>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {addons
                      .filter(a => [13, 14, 5, 10].includes(Number(a.id)))
                      .map(a => {
                        const on = selectedAddons.has(a.id);
                        return (
                          <div key={a.id} className={`p-3 rounded-xl border transition space-y-2 ${on ? 'border-emerald-500 bg-emerald-500/5' : 'border-theme bg-secondary'}`}>
                            <button onClick={() => setSelectedAddons(s => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })} className="w-full text-left flex items-start gap-3">
                              <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-500 border-emerald-500' : 'border-theme'}`}>{on && <lucide.Check className="w-3 h-3 text-black" />}</div>
                              <div className="flex-1">
                                <div className="flex justify-between gap-2">
                                  <span className="text-sm font-bold text-primary">{a.name}</span>
                                  <span className="text-xs font-black text-emerald-500 shrink-0">
                                    {a.price_type === 'per_word' ? `₦${a.price}/word` : `+${naira(a.price)}`}
                                  </span>
                                </div>
                                {a.description && <p className="text-[11px] text-secondary">{a.description}</p>}
                              </div>
                            </button>

                            {on && (
                              <div className="pl-7 space-y-2 border-t border-theme/20 pt-2 text-xs">
                                {/* If pricing type is per word */}
                                {a.price_type === 'per_word' && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-secondary text-[11px]">Word count:</span>
                                    <input
                                      type="number"
                                      min={500}
                                      step={100}
                                      value={addonWords[a.id] || 1000}
                                      onChange={e => {
                                        const w = Math.max(100, Number(e.target.value) || 0);
                                        setAddonWords(prev => ({ ...prev, [a.id]: w }));
                                      }}
                                      className="w-24 bg-card border border-theme rounded-md px-2 py-1 text-primary outline-none focus:border-emerald-500 font-mono text-center"
                                    />
                                    <span className="text-emerald-500 font-bold ml-1">
                                      ➔ {naira((addonWords[a.id] || 1000) * a.price)}
                                    </span>
                                  </div>
                                )}

                                {/* If location changer is active */}
                                {a.is_location_changer && (
                                  <div className="space-y-1">
                                    <span className="text-secondary text-[11px] block">Target Location / Case Study:</span>
                                    <input
                                      type="text"
                                      value={customLocation}
                                      onChange={e => setCustomLocation(e.target.value)}
                                      placeholder="e.g. Enugu State, University of Ibadan"
                                      className="w-full bg-card border border-theme rounded-md px-2 py-1 text-primary outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                )}

                                {/* If it has sub-features */}
                                {Array.isArray(a.features) && a.features.length > 0 && (
                                  <div className="space-y-1">
                                    <span className="text-secondary text-[10px] font-black uppercase tracking-wider block mb-1">Includes Features:</span>
                                    <div className="grid grid-cols-1 gap-1">
                                      {a.features.map((f, fi) => {
                                        const selected = (addonFeatures[a.id] || []).includes(f.name);
                                        return (
                                          <label key={`${a.id}-${fi}`} className="flex items-center gap-2 cursor-pointer py-0.5">
                                            <input
                                              type="checkbox"
                                              checked={selected}
                                              onChange={e => {
                                                const current = addonFeatures[a.id] || [];
                                                const next = e.target.checked
                                                  ? [...current, f.name]
                                                  : current.filter(x => x !== f.name);
                                                setAddonFeatures(prev => ({ ...prev, [a.id]: next }));
                                              }}
                                              className="w-3.5 h-3.5 accent-emerald-500 shrink-0"
                                            />
                                            <span className="text-secondary text-[11px] flex-1">{f.name}</span>
                                            <span className="text-secondary font-bold text-[11px] shrink-0">+{naira(f.price)}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center border-t border-theme pt-3">
                <span className="text-sm font-bold text-secondary">Total</span>
                <span className="text-2xl font-black text-emerald-500">{naira(cartTotal())}</span>
              </div>

              <label className="flex items-start gap-2 cursor-pointer bg-secondary border border-theme rounded-xl p-3">
                <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-500 shrink-0" />
                <span className="text-[11px] text-primary leading-relaxed">
                  {pageSettings.checkout_terms}
                  <strong className="block mt-1.5 text-emerald-500 font-bold">
                    * AI-free and plagiarism-free revisions are only performed if you select the respective "No AI" or "No Plagiarism" add-ons above.
                  </strong>
                </span>
              </label>

              {msg && <div className="text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{msg}</div>}

              <button 
                onClick={pay} 
                disabled={simulationState !== 'complete' || !acceptedTerms || busy || (isLoggedIn === false && !EMAIL_RE.test(guestEmail.trim()))} 
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black transition disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider text-xs"
              >
                {simulationState !== 'complete' 
                  ? 'Writer Allocation in Progress...' 
                  : busy 
                    ? 'Redirecting to payment…' 
                    : `Pay ${naira(cartTotal())} & Get Material`}
              </button>
              <p className="text-[10px] text-secondary text-center">Payment is required before your order is created — unpaid attempts are never saved.</p>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-theme py-8 text-center text-xs text-secondary">
        <p>© {new Date().getFullYear()} YourResearchWriter · Working hours 8am–7pm · <Link href="/" className="text-emerald-500 hover:underline">Home</Link></p>
      </footer>

      <ProjectsAssistant />
    </div>
  );
}
