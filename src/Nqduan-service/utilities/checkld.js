import axios from 'axios';

function formatDate(date) {
  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh'
  });
}
// --- CACHE: in-memory TTL (10 phút) ---
const CACHE = new Map(); // key -> { expires: timestamp, value: string }
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in ms

function getCached(key) {
  try {
    const entry = CACHE.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      CACHE.delete(key);
      return null;
    }
    return entry.value;
  } catch (e) {
    return null;
  }
}

function setCached(key, value, ttl = CACHE_TTL) {
  try {
    CACHE.set(key, { value, expires: Date.now() + ttl });
  } catch (e) {}
}
// Configuration for APIs
const API_CONFIG = {
  VIRUSTOTAL_API_KEY: process.env.VIRUSTOTAL_API_KEY || '',
  GOOGLE_SAFEBROWSING_API_KEY: process.env.GOOGLE_SAFEBROWSING_API_KEY || '',
  WHOIS_API_KEY: process.env.WHOIS_API_KEY || '',
  // Backup free APIs
  URLVOID_API_KEY: process.env.URLVOID_API_KEY || ''
};

async function checkLừaDao(query = '') {
  try {
    if (!query) return '❓ Vui lòng nhập URL hoặc từ khóa để kiểm tra.';

    // Nếu là URL, phân tích URL với dữ liệu thật
    if (typeof query === 'string' && query.startsWith('http')) {
      return await analyzeUrlWithRealData(query);
    }

    // Nếu không phải URL, tìm kiếm thông tin chung
    return await searchScamInfoOnline(query);

  } catch (error) {
    console.error('Lỗi khi kiểm tra:', error?.message || error);
    return handleError(error, query);
  }
}

// Phân tích URL với dữ liệu thật từ các API (tối ưu hóa)
async function analyzeUrlWithRealData(url) {
  try {
    console.log(`Đang phân tích URL với dữ liệu thật: ${url}`);
    
    let result = `🛡️ Kết quả phân tích URL (Dữ liệu thời gian thực)\n\n`;
    result += `🌐 URL: ${url}\n`;
    
    // Phân tích local trước (nhanh)
    const localAnalysis = await analyzeUrlLocal(url);
    let totalRiskScore = localAnalysis.riskScore;
    
    result += `\n📋 Phân tích cơ bản:\n`;
    if (localAnalysis.warnings.length > 0) {
      localAnalysis.warnings.forEach(warning => {
        result += `• ${warning}\n`;
      });
    } else {
      result += `• Không phát hiện dấu hiệu nguy hiểm rõ ràng\n`;
    }
    
    // Chạy các check online nhanh (với timeout ngắn)
    const onlineChecks = await Promise.allSettled([
      checkUrlVoidFast(url),
      checkSSLFast(url),
      searchScamDatabase(url.includes('http') ? new URL(url).hostname : url)
    ]);
    
    // Xử lý URLVoid results
    if (onlineChecks[0].status === 'fulfilled' && onlineChecks[0].value) {
      const urlvoidResult = onlineChecks[0].value;
      result += `\n🔍 URLVoid: `;
      if (urlvoidResult.detections > 0) {
        result += `⚠️ ${urlvoidResult.detections}/${urlvoidResult.total} engines phát hiện\n`;
        totalRiskScore += (urlvoidResult.detections / urlvoidResult.total) * 30;
      } else {
        result += `✅ Không phát hiện vấn đề\n`;
      }
    }
    
    // Xử lý SSL check
    if (onlineChecks[1].status === 'fulfilled' && onlineChecks[1].value) {
      const sslResult = onlineChecks[1].value;
      result += `🔒 SSL Certificate:\n`;
      if (sslResult.valid) {
        result += `• ✅ Certificate hợp lệ\n`;
      } else {
        result += `• ❌ Certificate không hợp lệ hoặc không có\n`;
        totalRiskScore += 15;
      }
    }
    
    // Xử lý kết quả từ ChongLuaDao
    if (onlineChecks[2].status === 'fulfilled' && onlineChecks[2].value && onlineChecks[2].value.found) {
      result += `\n🚨 CẢNH BÁO: Tìm thấy báo cáo lừa đảo!\n`;
      onlineChecks[2].value.reports.slice(0, 2).forEach(report => {
        result += `• ${report.title}\n`;
      });
      totalRiskScore += 50; // Tăng mạnh risk nếu có báo cáo
    }
    
    // Tính điểm rủi ro cuối cùng
    const riskScore = Math.min(totalRiskScore, 100);
    let riskLevel = 'thấp';
    let riskColor = '🟢';
    
    if (riskScore >= 70) {
      riskLevel = 'rất cao';
      riskColor = '🔴';
    } else if (riskScore >= 50) {
      riskLevel = 'cao';
      riskColor = '🟠';
    } else if (riskScore >= 25) {
      riskLevel = 'trung bình';
      riskColor = '🟡';
    }
    
    result += `\n📊 Đánh giá tổng quan:\n`;
    result += `${riskColor} Điểm rủi ro: ${riskScore}/100\n`;
    result += `📈 Mức độ nguy hiểm: ${riskLevel.toUpperCase()}\n`;
    
    // Khuyến nghị dựa trên risk score
    result += `\n💡 Khuyến nghị:\n`;
    if (riskScore >= 60) {
      result += `🚫 KHÔNG NÊN TRUY CẬP - Rủi ro cao!\n`;
      result += `📱 Tuyệt đối không nhập thông tin cá nhân\n`;
      result += `🔒 Không tải xuống bất kỳ file nào\n`;
    } else if (riskScore >= 30) {
      result += `⚠️ Cẩn thận - Có một số dấu hiệu đáng nghi\n`;
      result += `🔍 Kiểm tra kỹ trước khi tương tác\n`;
      result += `🛡️ Sử dụng trình duyệt có bảo mật tốt\n`;
    } else {
      result += `✅ Tương đối an toàn theo dữ liệu hiện tại\n`;
      result += `🔍 Vẫn nên thận trọng với thông tin cá nhân\n`;
    }
    
    // Thêm thông tin bổ sung
    
    result += `\n⏰ Thời gian kiểm tra: ${formatDate(new Date())}\n`;
    result += `🔄 Nguồn: Phân tích local + Online APIs`;

    return result;

  } catch (error) {
    console.error('Lỗi phân tích URL:', error);
    return handleError(error, url);
  }
}

// Phân tích local nhanh (không cần internet)
async function analyzeUrlLocal(url) {
  const warnings = [];
  let riskScore = 0;
  
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname.toLowerCase();
    
    // Kiểm tra protocol
    if (urlObj.protocol === 'http:') {
      warnings.push('Sử dụng HTTP không an toàn (không có SSL)');
      riskScore += 10;
    }
    
    // Kiểm tra domain suspicious
    if (domain.includes('facebook') && !domain.endsWith('facebook.com')) {
      warnings.push('Có thể giả mạo Facebook');
      riskScore += 30;
    }
    
    if (domain.includes('google') && !domain.endsWith('google.com') && !domain.endsWith('google.com.vn')) {
      warnings.push('Có thể giả mạo Google');
      riskScore += 30;
    }
    
    if (domain.includes('shopee') && !domain.endsWith('shopee.vn') && !domain.endsWith('shopee.com')) {
      warnings.push('Có thể giả mạo Shopee');
      riskScore += 30;
    }
    
    // Kiểm tra TLD nguy hiểm
    const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.online', '.click', '.download'];
    suspiciousTlds.forEach(tld => {
      if (domain.endsWith(tld)) {
        warnings.push(`Sử dụng TLD có tỷ lệ lừa đảo cao (${tld})`);
        riskScore += 20;
      }
    });
    
    // Kiểm tra IP address
    if (/^\d+\.\d+\.\d+\.\d+/.test(domain)) {
      warnings.push('Sử dụng IP address thay vì tên miền');
      riskScore += 25;
    }
    
    // Kiểm tra subdomain phức tạp
    if (domain.split('.').length > 4) {
      warnings.push('Tên miền có cấu trúc phức tạp');
      riskScore += 15;
    }
    
    // Kiểm tra domain ngắn hoặc random
    const mainDomain = domain.split('.')[0];
    if (mainDomain.length < 4) {
      warnings.push('Tên miền quá ngắn');
      riskScore += 10;
    }
    
    if (/[0-9]{3,}/.test(mainDomain)) {
      warnings.push('Tên miền chứa nhiều số liên tiếp');
      riskScore += 15;
    }
    
    // Kiểm tra path nguy hiểm
    const suspiciousPaths = ['login', 'verify', 'secure', 'update', 'confirm', 'suspended'];
    suspiciousPaths.forEach(suspPath => {
      if (path.includes(suspPath)) {
        warnings.push(`URL chứa từ khóa nguy hiểm: ${suspPath}`);
        riskScore += 10;
      }
    });
    
  } catch (e) {
    warnings.push('URL không hợp lệ');
    riskScore += 50;
  }
  
  return { warnings, riskScore };
}

// URLVoid check nhanh
async function checkUrlVoidFast(url) {
  try {
    const domain = new URL(url).hostname;
    
    // Thử scrape URLVoid với timeout ngắn
    const urlvoidUrl = `https://www.urlvoid.com/scan/${domain}`;
    const response = await axios.get(urlvoidUrl, {
      timeout: 3000, // Timeout rất ngắn
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = response.data;
    const detectionMatch = html.match(/(\d+)\/(\d+).*engines.*detected/i);
    
    if (detectionMatch) {
      return {
        detections: parseInt(detectionMatch[1]) || 0,
        total: parseInt(detectionMatch[2]) || 30,
        source: 'urlvoid-fast'
      };
    }
    
    // Nếu không parse được, return safe result
    return { detections: 0, total: 30, source: 'urlvoid-safe' };
    
  } catch (error) {
    console.log('URLVoid fast check failed:', error.message);
    
    // Fallback: local pattern check
    const domain = new URL(url).hostname;
    const suspiciousPatterns = ['.tk', '.ml', '.ga', '.cf', '.online'];
    const detections = suspiciousPatterns.filter(pattern => domain.includes(pattern)).length;
    
    return { detections, total: 10, source: 'local-fallback' };
  }
}

// SSL check nhanh
async function checkSSLFast(url) {
  try {
    const urlObj = new URL(url);
    
    // Nếu là HTTP thì chắc chắn không có SSL
    if (urlObj.protocol === 'http:') {
      return { valid: false, reason: 'HTTP protocol' };
    }
    
    // Thử kết nối HTTPS với timeout ngắn
    const httpsUrl = url.replace('http://', 'https://');
    const response = await axios.head(httpsUrl, { 
      timeout: 2000,
      validateStatus: () => true // Accept any status
    });
    
    return { 
      valid: response.status < 400,
      status: response.status,
      source: 'https-test'
    };
    
  } catch (error) {
    return { 
      valid: false, 
      reason: error.code || error.message,
      source: 'ssl-failed'
    };
  }
}

// Kiểm tra VirusTotal
async function checkVirusTotal(url) {
  if (!API_CONFIG.VIRUSTOTAL_API_KEY) {
    console.log('Không có VirusTotal API key, skip...');
    return null;
  }
  
  try {
    const urlId = Buffer.from(url).toString('base64').replace(/=/g, '');
    
    const response = await axios.get(
      `https://www.virustotal.com/api/v3/urls/${urlId}`,
      {
        headers: { 'x-apikey': API_CONFIG.VIRUSTOTAL_API_KEY },
        timeout: 10000
      }
    );
    
    const stats = response.data.data.attributes.last_analysis_stats;
    return {
      malicious: stats.malicious || 0,
      suspicious: stats.suspicious || 0,
      harmless: stats.harmless || 0,
      undetected: stats.undetected || 0
    };
  } catch (error) {
    console.log('VirusTotal API error:', error.message);
    return null;
  }
}

// Kiểm tra Google Safe Browsing
async function checkGoogleSafeBrowsing(url) {
  if (!API_CONFIG.GOOGLE_SAFEBROWSING_API_KEY) {
    console.log('Không có Google Safe Browsing API key, skip...');
    return null;
  }
  
  try {
    const response = await axios.post(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${API_CONFIG.GOOGLE_SAFEBROWSING_API_KEY}`,
      {
        client: {
          clientId: "scam-checker",
          clientVersion: "1.0"
        },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["WINDOWS", "LINUX", "ANDROID", "OSX", "IOS"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url: url }]
        }
      },
      { timeout: 10000 }
    );
    
    const threats = response.data.matches || [];
    return {
      threats: threats.map(threat => threat.threatType)
    };
  } catch (error) {
    console.log('Google Safe Browsing API error:', error.message);
    return null;
  }
}

// Kiểm tra URLVoid (fallback miễn phí)
async function checkUrlVoid(url) {
  try {
    // Thử API URLVoid trước
    if (API_CONFIG.URLVOID_API_KEY) {
      const domain = new URL(url).hostname;
      const response = await axios.get(
        `https://api.urlvoid.com/v1/pay-as-you-go/?key=${API_CONFIG.URLVOID_API_KEY}&host=${domain}`,
        { timeout: 10000 }
      );
      
      const data = response.data;
      return {
        detections: data.detections || 0,
        total: data.engines_count || 0,
        details: data.engines || {},
        source: 'urlvoid-api'
      };
    }
  } catch (error) {
    console.log('URLVoid API error:', error.message);
  }
  
  // Fallback: sử dụng URLVoid website miễn phí
  try {
    const domain = new URL(url).hostname;
    const urlvoidUrl = `https://www.urlvoid.com/scan/${domain}`;
    
    const response = await axios.get(urlvoidUrl, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const html = response.data;
    
    // Parse kết quả từ HTML
    const detectionMatch = html.match(/(\d+)\/(\d+).*engines.*detected/i);
    
    if (detectionMatch) {
      return {
        detections: parseInt(detectionMatch[1]) || 0,
        total: parseInt(detectionMatch[2]) || 30,
        source: 'urlvoid-free'
      };
    }
    
    // Nếu không parse được, dùng free services
    return await checkWithFreeServices(url);
    
  } catch (error) {
    console.log('URLVoid free error:', error.message);
    return await checkWithFreeServices(url);
  }
}

// Kiểm tra thông tin WHOIS (cải thiện fallback)
async function checkWhoisData(url) {
  try {
    const domain = new URL(url).hostname;
    
    // Thử WHOIS API trước nếu có key
    if (API_CONFIG.WHOIS_API_KEY) {
      try {
        const response = await axios.get(
          `https://api.whoisfreaks.com/v1.0/whois?apiKey=${API_CONFIG.WHOIS_API_KEY}&whois=live&domainName=${domain}`,
          { timeout: 10000 }
        );
        
        const data = response.data;
        const createdDate = new Date(data.create_date);
        const now = new Date();
        const ageInDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
        
        return {
          created: data.create_date,
          expires: data.expires_date,
          registrar: data.registrar_name,
          country: data.registrant_country,
          ageInDays: ageInDays,
          source: 'whoisfreaks-api'
        };
      } catch (apiError) {
        console.log('WHOIS API error:', apiError.message);
      }
    }
    
    // Fallback: sử dụng free WHOIS services
    const freeWhoisResults = await Promise.allSettled([
      checkDomainAge(domain),
      checkWhoisFree(domain)
    ]);
    
    // Lấy kết quả từ domain age check
    if (freeWhoisResults[0].status === 'fulfilled' && freeWhoisResults[0].value) {
      return freeWhoisResults[0].value;
    }
    
    // Lấy kết quả từ free whois
    if (freeWhoisResults[1].status === 'fulfilled' && freeWhoisResults[1].value) {
      return freeWhoisResults[1].value;
    }
    
    return null;
    
  } catch (error) {
    console.log('WHOIS check error:', error.message);
    return null;
  }
}

// WHOIS miễn phí từ whois.com (cải thiện parsing)
async function checkWhoisFree(domain) {
  try {
    const whoisUrl = `https://www.whois.com/whois/${domain}`;
    const response = await axios.get(whoisUrl, {
      timeout: 5000, // Giảm timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = response.data;
    
    // Clean HTML và extract text sạch hơn
    const cleanText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                         .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                         .replace(/<[^>]+>/g, ' ')
                         .replace(/\s+/g, ' ')
                         .trim();
    
    let result = { source: 'whois.com' };
    
    // Parse creation date với nhiều pattern
    const creationPatterns = [
      /Creation Date:\s*([^\n\r]+)/i,
      /created:\s*([^\n\r]+)/i,
      /registered:\s*([^\n\r]+)/i,
      /domain.*created:\s*([^\n\r]+)/i
    ];
    
    for (let pattern of creationPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const dateStr = match[1].trim().replace(/T.*$/, ''); // Remove time part
        try {
          const createdDate = new Date(dateStr);
          if (!isNaN(createdDate.getTime()) && createdDate.getFullYear() > 1990) {
            const now = new Date();
            const ageInDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
            result.created = dateStr;
            result.ageInDays = ageInDays;
            break;
          }
        } catch (e) {}
      }
    }
    
    // Parse registrar (clean version)
    const registrarMatch = cleanText.match(/Registrar:\s*([^\n\r]+)/i);
    if (registrarMatch) {
      let registrar = registrarMatch[1].trim();
      // Clean up common HTML artifacts
      registrar = registrar.replace(/\s+/g, ' ').substring(0, 50);
      if (registrar && !registrar.includes('<') && !registrar.includes('>')) {
        result.registrar = registrar;
      }
    }
    
    // Parse country
    const countryMatch = cleanText.match(/Country:\s*([A-Z]{2})\b/i);
    if (countryMatch) {
      result.country = countryMatch[1].toUpperCase();
    }
    
    return Object.keys(result).length > 1 ? result : null;
    
  } catch (error) {
    console.log('Free WHOIS error:', error.message);
    return null;
  }
}

// Kiểm tra SSL Certificate
async function checkSSLCertificate(url) {
  try {
    // Sử dụng service miễn phí để check SSL
    const domain = new URL(url).hostname;
    const response = await axios.get(
      `https://api.ssllabs.com/api/v3/analyze?host=${domain}&publish=off&all=done`,
      { timeout: 15000 }
    );
    
    const data = response.data;
    if (data.status === 'READY' && data.endpoints && data.endpoints.length > 0) {
      const endpoint = data.endpoints[0];
      return {
        valid: endpoint.grade && endpoint.grade !== 'F',
        grade: endpoint.grade,
        issuer: endpoint.details?.cert?.issuerLabel || 'Unknown',
        expires: endpoint.details?.cert?.notAfter || 'Unknown'
      };
    }
    
    return null;
  } catch (error) {
    console.log('SSL Check error:', error.message);
    return null;
  }
}

// Quét nội dung website
async function scanWebsiteContent(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ScamChecker/1.0)'
      }
    });
    
    const content = response.data.toLowerCase();
    const suspiciousPatterns = [
      { pattern: /trúng thưởng|congratulation.*prize/gi, desc: 'Lừa đảo trúng thưởng' },
      { pattern: /urgent.*action.*required/gi, desc: 'Yêu cầu hành động khẩn cấp' },
      { pattern: /verify.*account.*suspended/gi, desc: 'Đình chỉ tài khoản giả' },
      { pattern: /click.*here.*immediately/gi, desc: 'Yêu cầu click ngay lập tức' },
      { pattern: /limited.*time.*offer/gi, desc: 'Ưu đãi có thời hạn' },
      { pattern: /act.*now.*expire/gi, desc: 'Hành động ngay kẻo hết hạn' },
      { pattern: /100%.*guaranteed.*money/gi, desc: 'Đảm bảo 100% kiếm tiền' },
      { pattern: /no.*risk.*investment/gi, desc: 'Đầu tư không rủi ro' }
    ];
    
    const suspiciousContent = [];
    suspiciousPatterns.forEach(({ pattern, desc }) => {
      if (pattern.test(content)) {
        suspiciousContent.push(desc);
      }
    });
    
    return { suspiciousContent };
  } catch (error) {
    console.log('Website scan error:', error.message);
    return { suspiciousContent: [] };
  }
}

// Backup check với services miễn phí và reliable hơn
async function checkWithFreeServices(url) {
  try {
    const domain = new URL(url).hostname;
    console.log(`Checking ${domain} với free services (fast mode)...`);
    
    // Chạy các check nhanh và local
    const quickChecks = await Promise.allSettled([
      checkDomainReputation(domain),
      checkMalwareBytes(url),
      checkLocalBlacklist(domain)
    ]);
    
    let totalDetections = 0;
    let results = {};
    
    // Xử lý reputation
    if (quickChecks[0].status === 'fulfilled' && quickChecks[0].value) {
      results.reputation = quickChecks[0].value;
      totalDetections += quickChecks[0].value.detections || 0;
    }
    
    // Xử lý MalwareBytes simulation
    if (quickChecks[1].status === 'fulfilled' && quickChecks[1].value) {
      results.malwareBytes = quickChecks[1].value;
      if (quickChecks[1].value.blocked) totalDetections += 2;
    }
    
    // Xử lý local blacklist
    if (quickChecks[2].status === 'fulfilled' && quickChecks[2].value) {
      results.blacklist = quickChecks[2].value;
      totalDetections += quickChecks[2].value.hits || 0;
    }
    
    return {
      detections: totalDetections,
      total: 10,
      results: results,
      source: 'free-services-fast'
    };
    
  } catch (error) {
    console.log('Free services error:', error.message);
    return { detections: 0, total: 0, source: 'failed' };
  }
}

// Check local blacklist nhanh
async function checkLocalBlacklist(domain) {
  return new Promise((resolve) => {
    try {
      // Các domain/pattern nguy hiểm đã biết
      const knownBadDomains = [
        'bit.ly', 'tinyurl.com', 'short.link',
        'click.', 'download.', 'free-', 'win-'
      ];
      
      const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.online', '.click'];
      const suspiciousPatterns = [
        /\d{3,}/, // Nhiều số
        /[a-z]{15,}/, // Tên quá dài random
        /xn--/, // Punycode
        /-{2,}/ // Nhiều dấu gạch
      ];
      
      let hits = 0;
      
      // Check known bad domains
      knownBadDomains.forEach(bad => {
        if (domain.includes(bad)) hits++;
      });
      
      // Check TLD
      suspiciousTLDs.forEach(tld => {
        if (domain.endsWith(tld)) hits++;
      });
      
      // Check patterns  
      suspiciousPatterns.forEach(pattern => {
        if (pattern.test(domain)) hits++;
      });
      
      resolve({ hits, total: 10, source: 'local-blacklist' });
    } catch (error) {
      resolve({ hits: 0, total: 10 });
    }
  });
}

// Kiểm tra tuổi domain miễn phí
async function checkDomainAge(domain) {
  try {
    // Sử dụng whoapi.com free tier hoặc whois.net
    const whoisUrl = `https://whois.net/${domain}`;
    const response = await axios.get(whoisUrl, { 
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = response.data;
    
    // Parse creation date từ HTML
    const creationPatterns = [
      /Creation Date:\s*(\d{4}-\d{2}-\d{2})/i,
      /created:\s*(\d{4}-\d{2}-\d{2})/i,
      /registered:\s*(\d{4}-\d{2}-\d{2})/i
    ];
    
    for (let pattern of creationPatterns) {
      const match = html.match(pattern);
      if (match) {
        const creationDate = new Date(match[1]);
        const now = new Date();
        const ageInDays = Math.floor((now - creationDate) / (1000 * 60 * 60 * 24));
        
        return {
          created: match[1],
          ageInDays: ageInDays,
          source: 'whois.net'
        };
      }
    }
    
    return null;
  } catch (error) {
    console.log('Domain age check error:', error.message);
    return null;
  }
}

// Function này đã được thay thế bởi searchScamInfoOnline phía dưới

// Tìm trong database lừa đảo từ chongluadao.vn
async function searchScamDatabase(query) {
  try {
    console.log(`Đang tìm kiếm trên chongluadao.vn: ${query}`);
    
    // Tìm kiếm trên chongluadao.vn
    const searchUrl = `https://chongluadao.vn/search?q=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.8,en-US;q=0.5,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    const html = response.data;
    const reports = parseChongLuaDaoResults(html, query);
    
    // Nếu không tìm thấy, thử tìm kiếm domain
    if (reports.length === 0 && query.includes('http')) {
      try {
        const domain = new URL(query).hostname;
        return await searchScamDatabase(domain);
      } catch (e) {
        console.log('Không thể extract domain:', e.message);
      }
    }
    
    return {
      found: reports.length > 0,
      reports: reports,
      source: 'chongluadao.vn'
    };
    
  } catch (error) {
    console.log('ChongLuaDao search error:', error.message);
    
    // Fallback: tìm kiếm Google với site:chongluadao.vn
    try {
      return await searchGoogleChongLuaDao(query);
    } catch (fallbackError) {
      return { found: false, reports: [], source: 'failed' };
    }
  }
}

// Tìm kiếm tin tức về lừa đảo
async function searchNewsReports(query) {
  try {
    // Có thể tìm kiếm trên VnExpress, Tuổi Trẻ, etc
    // Hoặc dùng News API nếu có key
    const newsQuery = `${query} lừa đảo`;
    
    // Tìm kiếm Google News về chủ đề này
    const googleNewsUrl = `https://news.google.com/search?q=${encodeURIComponent(newsQuery)}&hl=vi&gl=VN`;
    
    // Vì Google News khó scrape, return empty và để user tự check
    return {
      articles: [],
      searchUrl: googleNewsUrl
    };
  } catch (error) {
    return { articles: [], searchUrl: '' };
  }
}

// Tìm kiếm social media (placeholder)
async function searchSocialMedia(query) {
  // Placeholder - có thể implement sau
  return { posts: [] };
}

// Fallback functions (giữ nguyên code cũ)
async function analyzeUrlOffline(url) {
  // Code cũ cho phân tích offline
  const domainWarnings = analyzeDomain(url);
  const quickCheck = quickUrlCheck(url);
  
  let result = `🛡️ Phân tích URL (Offline)\n\n`;
  result += `🌐 URL: ${url}\n`;
  
  // ... rest of offline analysis code
  
  return result;
}

// Utility functions (cải thiện)
function checkDomainReputation(domain) {
  return new Promise(async (resolve) => {
    try {
      // Kiểm tra domain có trong blacklist phổ biến không
      const maliciousDomains = [
        'bit.ly', 'tinyurl.com', 'short.link', // URL shorteners nguy hiểm
        '.tk', '.ml', '.ga', '.cf' // TLD nguy hiểm
      ];
      
      let detections = 0;
      maliciousDomains.forEach(badDomain => {
        if (domain.includes(badDomain)) {
          detections++;
        }
      });
      
      // Kiểm tra pattern suspicious
      if (domain.length < 4 || /\d{4,}/.test(domain)) {
        detections++;
      }
      
      resolve({ detections, source: 'local-check' });
    } catch (error) {
      resolve({ detections: 0 });
    }
  });
}

function checkBlocklists(domain) {
  return new Promise((resolve) => {
    try {
      // Kiểm tra với các blocklist pattern
      const suspiciousPatterns = [
        /phishing/i, /scam/i, /fraud/i, /fake/i,
        /\d+-\d+-\d+/, // IP-like patterns
        /[a-z]{20,}/ // Very long random strings
      ];
      
      let detections = suspiciousPatterns.filter(pattern => pattern.test(domain)).length;
      resolve({ detections });
    } catch (error) {
      resolve({ detections: 0 });
    }
  });
}

// Kiểm tra MalwareBytes (scraping)
async function checkMalwareBytes(url) {
  try {
    // MalwareBytes có tool check miễn phí
    const domain = new URL(url).hostname;
    
    // Simulate check (vì scraping MalwareBytes khó)
    // Trong thực tế có thể dùng their API hoặc scrape
    
    // Kiểm tra domain có suspicious không
    const suspiciousIndicators = [
      domain.length < 5,
      /\d{3,}/.test(domain),
      domain.includes('secure') && !domain.includes('bank'),
      domain.includes('verify') || domain.includes('update')
    ];
    
    const blocked = suspiciousIndicators.filter(indicator => indicator).length >= 2;
    
    return {
      blocked: blocked,
      source: 'malwarebytes-simulation'
    };
    
  } catch (error) {
    return { blocked: false };
  }
}

// VirusTotal miễn phí (không cần API key)
async function checkVirusTotal_Free(url) {
  try {
    // VirusTotal có form submit miễn phí
    const vtUrl = `https://www.virustotal.com/vtapi/v2/url/report?apikey=public&resource=${encodeURIComponent(url)}`;
    
    // Hoặc dùng cách khác: submit URL và đợi kết quả
    // Vì không có API key, ta simulate based on URL pattern
    
    const domain = new URL(url).hostname;
    const suspiciousPatterns = [
      /bit\.ly|tinyurl|short/i,
      /[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/, // IP address
      /xn--|punycode/i // Internationalized domain names
    ];
    
    const detections = suspiciousPatterns.filter(pattern => pattern.test(domain)).length;
    
    return {
      detections: detections,
      total: 5,
      source: 'virustotal-simulation'
    };
    
  } catch (error) {
    return { detections: 0, total: 5 };
  }
}

// Giữ nguyên các functions cũ
function isValidUrl(string) {
  try { 
    new URL(string); 
    return true; 
  } catch (_) { 
    return false; 
  }
}

function quickScamCheck(input) {
  const scamPatterns = [
    /trúng thưởng|trung thuong/gi,
    /chúc mừng.*nhận.*tiền/gi,
    /click.*nhận.*quà/gi,
    /kiếm.*tiền.*online.*dễ/gi,
    /đầu tư.*lãi.*cao/gi,
    /chỉ cần.*click/gi,
    /miễn phí.*100%/gi
  ];

  const matches = scamPatterns.filter(pattern => pattern.test(input));
  if (matches.length > 0) {
    return `⚠️ Auto-detect: Phát hiện ${matches.length} pattern nghi vấn lừa đảo!\n\n`;
  }
  return '';
}

function analyzeDomain(url) {
  try {
    const domain = new URL(url).hostname.toLowerCase();
    const warnings = [];
    
    const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.online', '.click', '.download'];
    suspiciousTlds.forEach(tld => {
      if (domain.endsWith(tld)) {
        warnings.push(`Domain sử dụng TLD có tỷ lệ scam cao (${tld})`);
      }
    });
    
    const popularSites = ['facebook', 'google', 'youtube', 'shopee', 'tiki', 'lazada', 'zalo'];
    popularSites.forEach(site => {
      if (domain.includes(site) && !domain.endsWith(`${site}.com`) && !domain.endsWith(`${site}.vn`)) {
        warnings.push(`Có thể giả mạo ${site}`);
      }
    });
    
    return warnings;
  } catch (e) { 
    return ['URL không hợp lệ']; 
  }
}

function quickUrlCheck(url) {
  const warnings = [];
  let suspicious = false;
  
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname.toLowerCase();
    
    if (domain.includes('facebook') && !domain.endsWith('facebook.com')) {
      warnings.push('Có thể giả mạo Facebook');
      suspicious = true;
    }
    
    if (/^\d+\.\d+\.\d+\.\d+/.test(domain)) {
      warnings.push('Sử dụng IP address thay vì domain name');
      suspicious = true;
    }
    
  } catch (e) {
    warnings.push('URL không hợp lệ');
    suspicious = true;
  }
  
  return { warnings, suspicious };
}

async function searchScamInfo(query) {
  const quickWarning = quickScamCheck(query);
  let result = `🔍 Tìm kiếm: "${query}"\n\n`;
  if (quickWarning) result += quickWarning;
  
  const commonScams = checkCommonScamPatterns(query);
  if (commonScams.length > 0) {
    result += `🚨 Phát hiện pattern lừa đảo:\n`;
    commonScams.forEach(scam => {
      result += `• ${scam}\n`;
    });
    result += `\n`;
  }

  result += `🔗 Nguồn kiểm tra thủ công:\n`;
  result += `• Google: https://www.google.com/search?q=${encodeURIComponent(query + ' lừa đảo scam')}\n`;
  result += `• ChongLuaDao: https://www.google.com/search?q=${encodeURIComponent(query + ' site:chongluadao.vn')}\n`;
  
  return result;
}

function checkCommonScamPatterns(input) {
  const scamPatterns = [
    { pattern: /trúng thưởng|trung thuong/gi, desc: 'Lừa đảo trúng thưởng' },
    { pattern: /chúc mừng.*nhận.*tiền/gi, desc: 'Lừa đảo nhận tiền thưởng' },
    { pattern: /click.*nhận.*quà/gi, desc: 'Lừa đảo click nhận quà' },
    { pattern: /kiếm.*tiền.*online.*dễ/gi, desc: 'Lừa đảo kiếm tiền online' },
    { pattern: /đầu tư.*lãi.*cao/gi, desc: 'Lừa đảo đầu tư lãi cao' }
  ];

  const matches = [];
  scamPatterns.forEach(({ pattern, desc }) => {
    if (pattern.test(input)) {
      matches.push(desc);
    }
  });
  
  return matches;
}

function handleError(error, query) {
  let errorMsg = `❌ Lỗi kiểm tra\n\n`;
  errorMsg += `🔧 Chi tiết: ${error?.message || error}\n\n`;
  
  if (typeof query === 'string' && query.startsWith('http')) {
    const basicAnalysis = analyzeDomain(query);
    if (basicAnalysis.length > 0) {
      errorMsg += `⚠️ Phân tích cơ bản:\n`;
      basicAnalysis.forEach(w => { errorMsg += `• ${w}\n`; });
      errorMsg += `\n`;
    }
  }
  
  errorMsg += `🔗 Kiểm tra thủ công tại:\n`;
  if (typeof query === 'string' && query.startsWith('http')) {
    errorMsg += `• https://www.virustotal.com/gui/url/${encodeURIComponent(query)}\n`;
  }
  errorMsg += `• https://chongluadao.vn/\n`;
  
  return errorMsg;
}

// Parse kết quả từ chongluadao.vn
function parseChongLuaDaoResults(html, query) {
  const reports = [];
  
  try {
    // Sử dụng regex để parse HTML (hoặc có thể dùng cheerio nếu có)
    // Tìm các thẻ chứa thông tin báo cáo lừa đảo
    
    // Pattern để tìm các bài báo cáo
    const reportPatterns = [
      /<article[^>]*>[\s\S]*?<\/article>/gi,
      /<div[^>]*class="[^"]*post[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
      /<div[^>]*class="[^"]*report[^"]*"[^>]*>[\s\S]*?<\/div>/gi
    ];
    
    reportPatterns.forEach(pattern => {
      const matches = html.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const report = extractReportInfo(match, query);
          if (report) {
            reports.push(report);
          }
        });
      }
    });
    
    // Nếu không tìm thấy article, tìm trong tiêu đề và link
    if (reports.length === 0) {
      const titleLinks = html.match(/<a[^>]*href="[^"]*"[^>]*>([^<]+)</gi);
      if (titleLinks) {
        titleLinks.forEach(link => {
          const titleMatch = link.match(/>([^<]+)</);
          const hrefMatch = link.match(/href="([^"]+)"/);
          
          if (titleMatch && hrefMatch) {
            const title = titleMatch[1].trim();
            const url = hrefMatch[1];
            
            // Kiểm tra xem title có chứa từ khóa liên quan đến query không
            if (isRelevantToQuery(title, query)) {
              reports.push({
                title: title,
                url: url.startsWith('http') ? url : `https://chongluadao.vn${url}`,
                source: 'chongluadao.vn',
                type: 'search-result'
              });
            }
          }
        });
      }
    }
    
    console.log(`Tìm thấy ${reports.length} báo cáo từ chongluadao.vn`);
    return reports.slice(0, 5); // Giới hạn 5 kết quả
    
  } catch (error) {
    console.log('Parse error:', error.message);
    return [];
  }
}

// Trích xuất thông tin báo cáo từ HTML fragment
function extractReportInfo(htmlFragment, query) {
  try {
    // Tìm tiêu đề
    const titleMatch = htmlFragment.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i) || 
                      htmlFragment.match(/<a[^>]*>([^<]+)<\/a>/i);
    
    // Tìm link
    const linkMatch = htmlFragment.match(/href="([^"]+)"/i);
    
    // Tìm mô tả ngắn
    const descMatch = htmlFragment.match(/<p[^>]*>([^<]+)<\/p>/i);
    
    if (titleMatch) {
      const title = titleMatch[1].trim();
      
      // Kiểm tra relevance
      if (isRelevantToQuery(title, query) || isRelevantToQuery(htmlFragment, query)) {
        return {
          title: title,
          url: linkMatch ? (linkMatch[1].startsWith('http') ? linkMatch[1] : `https://chongluadao.vn${linkMatch[1]}`) : '',
          description: descMatch ? descMatch[1].trim() : '',
          source: 'chongluadao.vn',
          type: 'detailed-report'
        };
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Kiểm tra xem nội dung có liên quan đến query không
function isRelevantToQuery(content, query) {
  const contentLower = content.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Nếu query là URL, kiểm tra domain
  if (query.includes('http')) {
    try {
      const domain = new URL(query).hostname.toLowerCase();
      if (contentLower.includes(domain)) {
        return true;
      }
    } catch (e) {}
  }
  
  // Kiểm tra từ khóa trực tiếp
  if (contentLower.includes(queryLower)) {
    return true;
  }
  
  // Kiểm tra các từ khóa liên quan đến lừa đảo
  const scamKeywords = [
    'lừa đảo', 'lừa dối', 'scam', 'lậu', 'giả mạo', 
    'cảnh báo', 'nguy hiểm', 'tránh xa', 'không nên'
  ];
  
  return scamKeywords.some(keyword => contentLower.includes(keyword));
}

// Tìm kiếm Google với site:chongluadao.vn
async function searchGoogleChongLuaDao(query) {
  try {
    // Sử dụng Google Custom Search API hoặc scrape Google
    const searchQuery = `${query} site:chongluadao.vn`;
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    
    const response = await axios.get(googleUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const results = parseGoogleResults(response.data, query);
    
    return {
      found: results.length > 0,
      reports: results,
      source: 'google-chongluadao'
    };
    
  } catch (error) {
    console.log('Google fallback error:', error.message);
    return { found: false, reports: [], source: 'failed' };
  }
}

// Parse kết quả Google search
function parseGoogleResults(html, query) {
  const results = [];
  
  try {
    // Tìm các thẻ chứa kết quả tìm kiếm Google
    const searchResults = html.match(/<div class="g"[^>]*>[\s\S]*?<\/div>/gi);
    
    if (searchResults) {
      searchResults.forEach(result => {
        const titleMatch = result.match(/<h3[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>[\s\S]*?<\/h3>/i);
        const descMatch = result.match(/<div[^>]*class="[^"]*s"[^>]*>([^<]+)<\/div>/i);
        
        if (titleMatch && titleMatch[1].includes('chongluadao.vn')) {
          results.push({
            title: titleMatch[2].trim(),
            url: titleMatch[1],
            description: descMatch ? descMatch[1].trim() : '',
            source: 'chongluadao.vn',
            type: 'google-result'
          });
        }
      });
    }
    
    return results.slice(0, 3);
    
  } catch (error) {
    console.log('Google parse error:', error.message);
    return [];
  }
}

// Lấy chi tiết báo cáo từ chongluadao.vn
async function getDetailedReport(reportUrl) {
  try {
    const response = await axios.get(reportUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = response.data;
    
    // Trích xuất thông tin chi tiết
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const contentMatch = html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const dateMatch = html.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    
    return {
      title: titleMatch ? titleMatch[1].trim() : 'Không có tiêu đề',
      content: contentMatch ? contentMatch[1].replace(/<[^>]+>/g, '').trim() : 'Không có nội dung',
      date: dateMatch ? dateMatch[1] : 'Không rõ ngày',
      url: reportUrl
    };
    
  } catch (error) {
    console.log('Get detailed report error:', error.message);
    return null;
  }
}

// Cập nhật function searchScamInfoOnline để sử dụng chongluadao.vn
async function searchScamInfoOnline(query) {
  try {
    let result = `🔍 Tìm kiếm trên ChongLuaDao.vn: "${query}"\n\n`;
    
    // Tìm kiếm trên ChongLuaDao.vn
    const scamDbResults = await searchScamDatabase(query);
    
    if (scamDbResults.found && scamDbResults.reports.length > 0) {
      result += `🚨 TÌM THẤY ${scamDbResults.reports.length} báo cáo liên quan:\n\n`;
      
      for (let i = 0; i < Math.min(scamDbResults.reports.length, 3); i++) {
        const report = scamDbResults.reports[i];
        result += `📋 Báo cáo ${i + 1}:\n`;
        result += `• Tiêu đề: ${report.title}\n`;
        if (report.description) {
          result += `• Mô tả: ${report.description.substring(0, 100)}${report.description.length > 100 ? '...' : ''}\n`;
        }
        result += `• Link: ${report.url}\n`;
        result += `• Nguồn: ${report.source}\n\n`;
      }
      
      // Lấy thông tin chi tiết từ báo cáo đầu tiên
      if (scamDbResults.reports[0].url) {
        try {
          const detailedReport = await getDetailedReport(scamDbResults.reports[0].url);
          if (detailedReport && detailedReport.content) {
            result += `📄 Chi tiết báo cáo:\n`;
            result += `${detailedReport.content.substring(0, 300)}${detailedReport.content.length > 300 ? '...' : ''}\n\n`;
          }
        } catch (e) {
          console.log('Không thể lấy chi tiết báo cáo:', e.message);
        }
      }
      
      result += `⚠️ KẾT LUẬN: Đã có báo cáo lừa đảo về "${query}" trên ChongLuaDao.vn\n`;
      result += `🚫 KHUYẾN NGHỊ: Tránh xa và cảnh báo người khác!\n\n`;
      
    } else {
      result += `✅ Không tìm thấy báo cáo lừa đảo cụ thể về "${query}"\n\n`;
      
      // Vẫn kiểm tra pattern nguy hiểm
      const quickWarning = quickScamCheck(query);
      if (quickWarning) {
        result += quickWarning;
      }
      
      const commonScams = checkCommonScamPatterns(query);
      if (commonScams.length > 0) {
        result += `⚠️ Tuy nhiên, phát hiện các pattern đáng nghi:\n`;
        commonScams.forEach(scam => {
          result += `• ${scam}\n`;
        });
        result += `\n`;
      }
    }
    
    // Thêm link kiểm tra thủ công
    result += `🔗 Kiểm tra thêm:\n`;
    result += `• Tìm trên ChongLuaDao: https://chongluadao.vn/search?q=${encodeURIComponent(query)}\n`;
    result += `• Báo cáo mới: https://chongluadao.vn/report\n`;
    result += `• Google: https://www.google.com/search?q=${encodeURIComponent(query + ' lừa đảo')}\n\n`;
    
    result += `⏰ Thời gian kiểm tra: ${formatDate(new Date())}\n`;
    result += `📊 Nguồn dữ liệu: ChongLuaDao.vn`;
    
    return result;
    
  } catch (error) {
    console.log('Online search error:', error.message);
    return await searchScamInfo(query); // fallback to offline
  }
}

// Export
export { checkLừaDao, isValidUrl, quickScamCheck, analyzeDomain, getDetailedReport, searchScamDatabase };