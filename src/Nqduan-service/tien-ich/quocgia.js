import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { sendMessageFactory } from '../../api-zalo/apis/sendMessage.js';
import { getGlobalPrefix } from '../service.js';
import { nameServer } from '../../database/index.js';

export const des = {
  name: 'quocgia',
  type: 1,
  permission: 'all',
  countdown: 30,
  active: true,
};

// --- ✅ MAP TÊN QUỐC GIA VÀ VÙNG LÃNH THỔ ĐẦY ĐỦ NHẤT ---
const vietnameseToEnglishMap = {
    // A
    'afghanistan': 'afghanistan',
    'åland islands': 'åland islands',
    'aland': 'åland islands',
    'albania': 'albania',
    'algeria': 'algeria',
    'an giê ri': 'algeria',
    'american samoa': 'american samoa',
    'samoa thuộc mỹ': 'american samoa',
    'andorra': 'andorra',
    'angola': 'angola',
    'anguilla': 'anguilla',
    'nam cực': 'antarctica',
    'antigua and barbuda': 'antigua and barbuda',
    'argentina': 'argentina',
    'ác hen ti na': 'argentina',
    'armenia': 'armenia',
    'ác mê ni a': 'armenia',
    'aruba': 'aruba',
    'úc': 'australia',
    'australia': 'australia',
    'áo': 'austria',
    'azerbaijan': 'azerbaijan',
    // B
    'bahamas': 'bahamas',
    'bahrain': 'bahrain',
    'bangladesh': 'bangladesh',
    'barbados': 'barbados',
    'belarus': 'belarus',
    'bỉ': 'belgium',
    'belgium': 'belgium',
    'belize': 'belize',
    'bénin': 'benin',
    'benin': 'benin',
    'bermuda': 'bermuda',
    'bhutan': 'bhutan',
    'bolivia': 'bolivia',
    'bô li vi a': 'bolivia',
    'bonaire, sint eustatius and saba': 'bonaire, sint eustatius and saba',
    'bosnia and herzegovina': 'bosnia and herzegovina',
    'botswana': 'botswana',
    'bouvet island': 'bouvet island',
    'brazil': 'brazil',
    'bra sin': 'brazil',
    'british indian ocean territory': 'british indian ocean territory',
    'lãnh thổ ấn độ dương thuộc anh': 'british indian ocean territory',
    'brunei darussalam': 'brunei darussalam',
    'brunei': 'brunei',
    'bulgaria': 'bulgaria',
    'bun ga ri': 'bulgaria',
    'burkina faso': 'burkina faso',
    'burundi': 'burundi',
    // C
    'cabo verde': 'cabo verde',
    'campuchia': 'cambodia',
    'cam pu chia': 'cambodia',
    'cam': 'cambodia',
    'cameroon': 'cameroon',
    'canada': 'canada',
    'cayman islands': 'cayman islands',
    'quần đảo cayman': 'cayman islands',
    'central african republic': 'central african republic',
    'cộng hòa trung phi': 'central african republic',
    'chad': 'chad',
    'sát': 'chad',
    'chile': 'chile',
    'chi lê': 'chile',
    'trung quốc': 'china',
    'tq': 'china',
    'christmas island': 'christmas island',
    'đảo giáng sinh': 'christmas island',
    'cocos (keeling) islands': 'cocos (keeling) islands',
    'colombia': 'colombia',
    'cô lôm bi a': 'colombia',
    'comoros': 'comoros',
    'congo': 'congo',
    'công gô': 'congo',
    'congo (democratic republic of the)': 'democratic republic of the congo',
    'cộng hòa dân chủ công gô': 'democratic republic of the congo',
    'cook islands': 'cook islands',
    'quần đảo cook': 'cook islands',
    'costa rica': 'costa rica',
    'cô sta ri ca': 'costa rica',
    'côte d\'ivoire': 'côte d\'ivoire',
    'bờ biển ngà': 'côte d\'ivoire',
    'croatia': 'croatia',
    'crô a ti a': 'croatia',
    'cuba': 'cuba',
    'cu ba': 'cuba',
    'curaçao': 'curaçao',
    'cyprus': 'cyprus',
    'síp': 'cyprus',
    'czechia': 'czechia',
    'cộng hòa séc': 'czechia',
    // D
    'đan mạch': 'denmark',
    'denmark': 'denmark',
    'djibouti': 'djibouti',
    'dominica': 'dominica',
    'dominican republic': 'dominican republic',
    'cộng hòa dominica': 'dominican republic',
    // E
    'ecuador': 'ecuador',
    'ê cu a đo': 'ecuador',
    'ai cập': 'egypt',
    'el salvador': 'el salvador',
    'en san va đo': 'el salvador',
    'equatorial guinea': 'equatorial guinea',
    'guinea xích đạo': 'equatorial guinea',
    'eritrea': 'eritrea',
    'estonia': 'estonia',
    'eswatini': 'eswatini',
    'ethiopia': 'ethiopia',
    // F
    'falkland islands (malvinas)': 'falkland islands (malvinas)',
    'faroe islands': 'faroe islands',
    'fiji': 'fiji',
    'phần lan': 'finland',
    'finland': 'finland',
    'pháp': 'france',
    'french guiana': 'french guiana',
    'french polynesia': 'french polynesia',
    'french southern territories': 'french southern territories',
    // G
    'gabon': 'gabon',
    'gambia': 'gambia',
    'georgia': 'georgia',
    'gruzia': 'georgia',
    'đức': 'germany',
    'ghana': 'ghana',
    'gibraltar': 'gibraltar',
    'hy lạp': 'greece',
    'greece': 'greece',
    'greenland': 'greenland',
    'grenada': 'grenada',
    'guadeloupe': 'guadeloupe',
    'guam': 'guam',
    'guatemala': 'guatemala',
    'guernsey': 'guernsey',
    'guinea': 'guinea',
    'ghi nê': 'guinea',
    'guinea-bissau': 'guinea-bissau',
    'guyana': 'guyana',
    // H
    'haiti': 'haiti',
    'heard island and mcdonald islands': 'heard island and mcdonald islands',
    'holy see': 'holy see',
    'tòa thánh': 'holy see',
    'vatican': 'holy see',
    'honduras': 'honduras',
    'hồng kông': 'hong kong',
    'hong kong': 'hong kong',
    'hungary': 'hungary',
    'hung ga ri': 'hungary',
    // I
    'iceland': 'iceland',
    'ai xơ len': 'iceland',
    'ấn độ': 'india',
    'indonesia': 'indonesia',
    'in đô nê xi a': 'indonesia',
    'indo': 'indonesia',
    'iran': 'iran',
    'i ran': 'iran',
    'iraq': 'iraq',
    'i rắc': 'iraq',
    'ireland': 'ireland',
    'ai len': 'ireland',
    'isle of man': 'isle of man',
    'israel': 'israel',
    'i xra en': 'israel',
    'ý': 'italy',
    'italia': 'italy',
    // J
    'jamaica': 'jamaica',
    'nhật': 'japan',
    'nhật bản': 'japan',
    'jp': 'japan',
    'jersey': 'jersey',
    'jordan': 'jordan',
    // K
    'kazakhstan': 'kazakhstan',
    'kenya': 'kenya',
    'kiribati': 'kiribati',
    'korea (democratic people\'s republic of)': 'north korea',
    'triều tiên': 'north korea',
    'bắc triều tiên': 'north korea',
    'korea (republic of)': 'south korea',
    'hàn quốc': 'south korea',
    'hàn': 'south korea',
    'hq': 'south korea',
    'kr': 'south korea',
    'kuwait': 'kuwait',
    'cô oét': 'kuwait',
    'kyrgyzstan': 'kyrgyzstan',
    // L
    'lao people\'s democratic republic': 'laos',
    'lào': 'laos',
    'latvia': 'latvia',
    'lebanon': 'lebanon',
    'li băng': 'lebanon',
    'lesotho': 'lesotho',
    'liberia': 'liberia',
    'libya': 'libya',
    'li bi': 'libya',
    'liechtenstein': 'liechtenstein',
    'lithuania': 'lithuania',
    'luxembourg': 'luxembourg',
    // M
    'macao': 'macao',
    'ma cao': 'macao',
    'madagascar': 'madagascar',
    'malawi': 'malawi',
    'malaysia': 'malaysia',
    'mã lai': 'malaysia',
    'maldives': 'maldives',
    'man đi vơ': 'maldives',
    'mali': 'mali',
    'malta': 'malta',
    'marshall islands': 'marshall islands',
    'quần đảo marshall': 'marshall islands',
    'martinique': 'martinique',
    'mauritania': 'mauritania',
    'mauritius': 'mauritius',
    'mayotte': 'mayotte',
    'mexico': 'mexico',
    'mê hi cô': 'mexico',
    'micronesia (federated states of)': 'micronesia',
    'moldova (republic of)': 'moldova',
    'monaco': 'monaco',
    'công quốc monaco': 'monaco',
    'mông cổ': 'mongolia',
    'mongolia': 'mongolia',
    'montenegro': 'montenegro',
    'montserrat': 'montserrat',
    'ma rốc': 'morocco',
    'morocco': 'morocco',
    'mozambique': 'mozambique',
    'myanmar': 'myanmar',
    'miến điện': 'myanmar',
    // N
    'namibia': 'namibia',
    'nauru': 'nauru',
    'nepal': 'nepal',
    'hà lan': 'netherlands',
    'netherlands': 'netherlands',
    'new caledonia': 'new caledonia',
    'new zealand': 'new zealand',
    'niu di lân': 'new zealand',
    'nicaragua': 'nicaragua',
    'niger': 'niger',
    'nigeria': 'nigeria',
    'niue': 'niue',
    'norfolk island': 'norfolk island',
    'đảo norfolk': 'norfolk island',
    'north macedonia': 'north macedonia',
    'bắc macedonia': 'north macedonia',
    'northern mariana islands': 'northern mariana islands',
    'na uy': 'norway',
    'norway': 'norway',
    // O
    'oman': 'oman',
    // P
    'pakistan': 'pakistan',
    'pa ki stan': 'pakistan',
    'palau': 'palau',
    'palestine, state of': 'palestine',
    'palestine': 'palestine',
    'panama': 'panama',
    'papua new guinea': 'papua new guinea',
    'paraguay': 'paraguay',
    'peru': 'peru',
    'pê ru': 'peru',
    'philippines': 'philippines',
    'phi líp pin': 'philippines',
    'phil': 'philippines',
    'pitcairn': 'pitcairn',
    'ba lan': 'poland',
    'poland': 'poland',
    'bồ đào nha': 'portugal',
    'portugal': 'portugal',
    'bđn': 'portugal',
    'puerto rico': 'puerto rico',
    // Q
    'qatar': 'qatar',
    // R
    'réunion': 'réunion',
    'romania': 'romania',
    'ru ma ni': 'romania',
    'russian federation': 'russia',
    'nga': 'russia',
    'rwanda': 'rwanda',
    // S
    'saint barthélemy': 'saint barthélemy',
    'saint helena, ascension and tristan da cunha': 'saint helena, ascension and tristan da cunha',
    'saint kitts and nevis': 'saint kitts and nevis',
    'saint lucia': 'saint lucia',
    'saint martin (french part)': 'saint martin (french part)',
    'saint pierre and miquelon': 'saint pierre and miquelon',
    'saint vincent and the grenadines': 'saint vincent and the grenadines',
    'samoa': 'samoa',
    'san marino': 'san marino',
    'sao tome and principe': 'sao tome and principe',
    'saudi arabia': 'saudi arabia',
    'ả rập xê út': 'saudi arabia',
    'senegal': 'senegal',
    'xê nê gan': 'senegal',
    'serbia': 'serbia',
    'xéc bi a': 'serbia',
    'seychelles': 'seychelles',
    'sierra leone': 'sierra leone',
    'singapore': 'singapore',
    'sing': 'singapore',
    'sint maarten (dutch part)': 'sint maarten (dutch part)',
    'slovakia': 'slovakia',
    'slovenia': 'slovenia',
    'solomon islands': 'solomon islands',
    'quần đảo solomon': 'solomon islands',
    'somalia': 'somalia',
    'sô ma li': 'somalia',
    'nam phi': 'south africa',
    'south africa': 'south africa',
    'south georgia and the south sandwich islands': 'south georgia and the south sandwich islands',
    'nam sudan': 'south sudan',
    'south sudan': 'south sudan',
    'tây ban nha': 'spain',
    'spain': 'spain',
    'tbn': 'spain',
    'sri lanka': 'sri lanka',
    'sri lan ca': 'sri lanka',
    'sudan': 'sudan',
    'xu đăng': 'sudan',
    'suriname': 'suriname',
    'svalbard and jan mayen': 'svalbard and jan mayen',
    'thụy điển': 'sweden',
    'sweden': 'sweden',
    'thụy sĩ': 'switzerland',
    'switzerland': 'switzerland',
    'syrian arab republic': 'syria',
    'syria': 'syria',
    'xi ri': 'syria',
    // T
    'taiwan, province of china': 'taiwan',
    'đài loan': 'taiwan',
    'taiwan': 'taiwan',
    'tajikistan': 'tajikistan',
    'tanzania, united republic of': 'tanzania',
    'thái lan': 'thailand',
    'thailand': 'thailand',
    'thái': 'thailand',
    'timor-leste': 'timor-leste',
    'đông timor': 'timor-leste',
    'togo': 'togo',
    'tokelau': 'tokelau',
    'tonga': 'tonga',
    'trinidad and tobago': 'trinidad and tobago',
    'tunisia': 'tunisia',
    'tu ni di': 'tunisia',
    'turkey': 'turkey',
    'thổ nhĩ kỳ': 'turkey',
    'turkmenistan': 'turkmenistan',
    'turks and caicos islands': 'turks and caicos islands',
    'tuvalu': 'tuvalu',
    // U
    'uganda': 'uganda',
    'ukraine': 'ukraine',
    'u crai na': 'ukraine',
    'united arab emirates': 'united arab emirates',
    'các tiểu vương quốc ả rập thống nhất': 'united arab emirates',
    'uae': 'united arab emirates',
    'united kingdom of great britain and northern ireland': 'united kingdom',
    'vương quốc anh': 'united kingdom',
    'anh': 'united kingdom',
    'uk': 'united kingdom',
    'hoa kỳ': 'united states',
    'mỹ': 'united states',
    'usa': 'united states',
    'united states': 'united states',
    'united states minor outlying islands': 'united states minor outlying islands',
    'uruguay': 'uruguay',
    'u ru goay': 'uruguay',
    'uzbekistan': 'uzbekistan',
    // V
    'vanuatu': 'vanuatu',
    'venezuela (bolivarian republic of)': 'venezuela',
    'venezuela': 'venezuela',
    'việt nam': 'vietnam',
    'vietnam': 'vietnam',
    'vn': 'vietnam',
    'virgin islands (british)': 'virgin islands (british)',
    'virgin islands (u.s.)': 'virgin islands (u.s.)',
    // W
    'wallis and futuna': 'wallis and futuna',
    'western sahara': 'western sahara',
    // Y
    'yemen': 'yemen',
    'y ê men': 'yemen',
    // Z
    'zambia': 'zambia',
    'zimbabwe': 'zimbabwe',
};

function getEnglishCountryName(name) {
    const normalizedName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();
    return vietnameseToEnglishMap[normalizedName] || name;
}

// Hàm ghép dòng tag + tên server (Giữ nguyên)
const getCleanNameServer = () => {
  const lines = nameServer
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);

  const tagLine = lines.find(line => line.startsWith('@'));
  const boldLine = lines.find(line => /\*\*(.*?)\*\*/.test(line) || /__(.*?)__/.test(line));

  return [tagLine, boldLine].filter(Boolean).join(' ');
};

// Hàm tải ảnh về máy (Giữ nguyên)
async function downloadImage(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Không thể tải ảnh cờ!');
  const buffer = await res.buffer();
  fs.writeFileSync(filePath, buffer);
}

export async function handleQuocgiaCommand(api, message) {
  const threadId = message.threadId;
  const uid = message.data.uidFrom;
  const sendMessage = sendMessageFactory(api);
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  let isGroup = threadId !== uid;
  if (typeof message.isGroup !== 'undefined') isGroup = message.isGroup;

  const command = `${currentPrefix}quocgia`;
  if (!content.startsWith(command)) {
    return;
  }

  const query = content.slice(command.length).trim();
  
  if (query.length === 0) {
    return sendMessage(
      {
        msg: `${getCleanNameServer()}❌ Vui lòng nhập quốc gia vào.\n👉 Ví dụ: ${command} việt nam`,
        ttl: 60000
      },
      threadId,
      isGroup ? 1 : 0
    );
  }

  const englishQuery = getEnglishCountryName(query);
  const countryName = encodeURIComponent(englishQuery);
  
  const fields = [
    'name', 'capital', 'region', 'subregion', 'population', 'languages', 
    'timezones', 'continents', 'maps', 'flags', 'flag', 'currencies', 'borders'
  ].join(',');
  const url = `https://restcountries.com/v3.1/name/${countryName}?fields=${fields}`;

  let flagPath = '';

  try {
    const response = await fetch(url, { timeout: 15000 });
    const data = await response.json();

    if (!response.ok || !Array.isArray(data) || data.length === 0) {
      return sendMessage(
        {
          msg: `${getCleanNameServer()}❌ Không tìm thấy thông tin cho "${query}".`,
          ttl: 60000
        },
        threadId,
        isGroup ? 1 : 0
      );
    }

    const info = data[0];
    
    const name = info?.name?.common || query;
    const officialName = info?.name?.official || 'N/A';
    const nativeCommon = info?.name?.nativeName?.vie?.common || 'N/A';
    const capital = Array.isArray(info?.capital) && info.capital[0] ? info.capital.join(', ') : 'N/A';
    const region = info?.region || 'N/A';
    const subregion = info?.subregion || 'N/A';
    const population = typeof info?.population === 'number' ? info.population.toLocaleString('vi-VN') : 'N/A';
    const languages = info?.languages ? Object.values(info.languages).join(', ') : 'N/A';
    const timezones = Array.isArray(info?.timezones) ? info.timezones.join(', ') : 'N/A';
    const continents = Array.isArray(info?.continents) ? info.continents.join(', ') : 'N/A';
    const googleMaps = info?.maps?.googleMaps || 'N/A';
    const flagsPNG = info?.flags?.png || null;
    const emojiFlag = info?.flag || '';
    const borders = Array.isArray(info?.borders) ? info.borders.join(', ') : 'Không có';
    const currencies = info?.currencies
      ? Object.entries(info.currencies)
          .map(([code, { name, symbol }]) => `${name} (${code}, ${symbol || 'N/A'})`)
          .join('\n')
      : 'N/A';

    const msg = `${getCleanNameServer()}
${emojiFlag} Thông tin quốc gia ${emojiFlag}

🗺️ Tên quốc gia: ${name} (${officialName})
🏠 Tên bản địa: ${nativeCommon}
🏛️ Thủ đô: ${capital}
🌍 Khu vực: ${region} - ${subregion}
👥 Dân số: ${population}
🗣️ Ngôn ngữ: ${languages}
💰 Tiền tệ: ${currencies}
⏰ Múi giờ: ${timezones}
🌐 Lục địa: ${continents}
🔗 Nước láng giềng: ${borders}
📍 Google Maps: ${googleMaps}`;

    const messagePayload = {
        msg: msg,
        ttl: 3600000,
        attachments: []
    };
    
    if (flagsPNG) {
        const tmpDir = path.join(os.tmpdir(), 'country-flags');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
        
        const safeQueryName = query.replace(/[^a-zA-Z0-9]/g, '_');
        flagPath = path.join(tmpDir, `flag_${safeQueryName}_${Date.now()}.png`);

        await downloadImage(flagsPNG, flagPath);
        messagePayload.attachments.push(flagPath);
    }

    await sendMessage(messagePayload, threadId, isGroup ? 1 : 0);

  } catch (err) {
    console.error('❌ Quocgia Error:', err);
    await sendMessage(
      {
        msg: `${getCleanNameServer()}❌ Lỗi: Đã xảy ra lỗi khi tìm thông tin. Vui lòng thử lại sau.`,
        ttl: 60000
      },
      threadId,
      isGroup ? 1 : 0
    );
  } finally {
    if (flagPath && fs.existsSync(flagPath)) {
        fs.unlinkSync(flagPath);
    }
  }
}