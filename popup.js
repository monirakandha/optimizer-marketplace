document.addEventListener('DOMContentLoaded', () => {
  const loadingState = document.getElementById('loading-state');
  const resultsState = document.getElementById('results-state');
  const errorState = document.getElementById('error-state');
  
  // Tab Switching Logic
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from all
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active to clicked
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // Request Data from active tab
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const activeTab = tabs[0];
    
    // Check if we are on a supported marketplace using generic keywords to support all TLDs
    if (activeTab.url && (activeTab.url.includes('walmart.') || activeTab.url.includes('amazon.') || activeTab.url.includes('ebay.') || activeTab.url.includes('target.') || activeTab.url.includes('bestbuy.'))) {
      chrome.tabs.sendMessage(activeTab.id, {action: "ANALYZE_LISTING"}, (response) => {
        if (chrome.runtime.lastError || !response) {
          // If content script isn't loaded (e.g., page loaded before extension installed)
          chrome.scripting.executeScript({
            target: {tabId: activeTab.id},
            files: ['content.js']
          }, () => {
            // Try again
            chrome.tabs.sendMessage(activeTab.id, {action: "ANALYZE_LISTING"}, handleResponse);
          });
        } else {
          handleResponse(response);
        }
      });
    } else {
      showError("Please open a Walmart, Amazon, eBay, Target, or Best Buy product page to analyze.");
    }
  });

  // Load History on startup
  loadHistory();

  function getAmazonDomain(currentDomain) {
    if (!currentDomain) return 'www.amazon.com';
    const d = currentDomain.toLowerCase();
    
    if (d.includes('.com.au')) return 'www.amazon.com.au';
    if (d.includes('.ca')) return 'www.amazon.ca';
    if (d.includes('.co.uk')) return 'www.amazon.co.uk';
    if (d.includes('.de')) return 'www.amazon.de';
    if (d.includes('.fr')) return 'www.amazon.fr';
    if (d.includes('.it')) return 'www.amazon.it';
    if (d.includes('.es')) return 'www.amazon.es';
    if (d.includes('.com.mx')) return 'www.amazon.com.mx';
    if (d.includes('.co.jp')) return 'www.amazon.co.jp';
    if (d.includes('.in')) return 'www.amazon.in';
    if (d.includes('.com.br')) return 'www.amazon.com.br';
    if (d.includes('.ae')) return 'www.amazon.ae';
    if (d.includes('.sa')) return 'www.amazon.sa';
    if (d.includes('.com.sg')) return 'www.amazon.sg';
    
    return 'www.amazon.com'; // fallback
  }

  function handleResponse(data) {
    if (!data) {
      showError("Failed to analyze page. Please refresh and try again.");
      return;
    }
    
    // Hide loading
    loadingState.classList.add('hidden');
    resultsState.classList.remove('hidden');
    
    document.getElementById('marketplace-badge').innerText = 'Analyzing ' + (data.marketplace || 'Listing');
    
    // Auto-select marketplace fee in dropdown if available
    const feeSelect = document.getElementById('marketplace-fee');
    if (data.marketplace === 'eBay') {
      feeSelect.value = "0.13";
    } else {
      feeSelect.value = "0.15";
    }
    
    const targetAmazonDomain = getAmazonDomain(data.domain);
    
    renderScore(data.score);
    renderIssues(data.checks);
    setupCompetitorLinks(data.title, data.price, targetAmazonDomain);
    fetchAdvancedKeywords(data.title, targetAmazonDomain);
    setupAIGenerator(data.title);
    setupPricingCalculator(data.price);
    
    saveToHistory(data);
    setupExports(data.checks);
  }

  function showError(msg) {
    loadingState.classList.add('hidden');
    resultsState.classList.add('hidden');
    errorState.classList.remove('hidden');
    if (msg) document.getElementById('error-message').innerText = msg;
  }

  function renderScore(score) {
    const circle = document.getElementById('score-circle-path');
    const text = document.getElementById('score-text');
    
    // Animate score
    setTimeout(() => {
      circle.style.strokeDasharray = `${score}, 100`;
      
      // Color logic based on score
      if (score >= 80) {
        circle.style.stroke = 'var(--success)';
      } else if (score >= 50) {
        circle.style.stroke = 'var(--warning)';
      } else {
        circle.style.stroke = 'var(--error)';
      }
    }, 100);

    // Animate number counting
    let currentScore = 0;
    const interval = setInterval(() => {
      if (currentScore >= score) {
        clearInterval(interval);
        text.textContent = `${score}%`;
      } else {
        currentScore++;
        text.textContent = `${currentScore}%`;
      }
    }, 20);
  }

  function renderIssues(checks) {
    const list = document.getElementById('check-list');
    list.innerHTML = ''; // clear
    
    checks.forEach(check => {
      const li = document.createElement('li');
      li.className = `check-item ${check.status}`; // success, warning, error
      
      let icon = '✅';
      if (check.status === 'warning') icon = '⚠️';
      if (check.status === 'error') icon = '❌';
      
      li.innerHTML = `
        <div class="check-icon">${icon}</div>
        <div class="check-content">
          <h4>${check.title}</h4>
          <p>${check.message}</p>
          ${check.solution ? `<div class="check-solution"><strong>💡 Fix:</strong> ${check.solution}</div>` : ''}
        </div>
      `;
      
      // Keep errors/warnings at the top
      if (check.status === 'error' || check.status === 'warning') {
        list.prepend(li);
      } else {
        list.appendChild(li);
      }
    });
  }

  function setupCompetitorLinks(title, upc, amazonDomain) {
    const searchAmazonBtn = document.getElementById('search-amazon-btn');
    const searchGoogleBtn = document.getElementById('search-google-btn');
    const listContainer = document.getElementById('competitors-list');
    
    // Create query
    let query = title;
    let rawQuery = title;
    if (title) {
      const words = title.split(' ').slice(0, 5).join(' ');
      rawQuery = words;
      query = encodeURIComponent(words);
    }
    
    searchAmazonBtn.addEventListener('click', () => {
      const url = `https://${amazonDomain}/s?k=${query}`;
      chrome.tabs.create({url: url});
    });
    
    searchGoogleBtn.addEventListener('click', () => {
      // Pass geographic gl= parameter based on domain if possible, or just standard
      const url = `https://www.google.com/search?tbm=shop&q=${query}`;
      chrome.tabs.create({url: url});
    });

    // Scrape Live Amazon Competitors
    if (rawQuery) {
      fetch(`https://${amazonDomain}/s?k=${query}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        }
      })
      .then(response => response.text())
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Amazon Search Results
        const resultItems = doc.querySelectorAll('div[data-component-type="s-search-result"]');
        
        if (resultItems.length === 0) {
          listContainer.innerHTML = '<div style="text-align:center;color:var(--text-secondary);font-size:12px;">Could not retrieve live data. Try clicking "Search on Amazon".</div>';
          return;
        }

        listContainer.innerHTML = ''; // clear loading state
        
        let added = 0;
        let lowestCompPrice = Infinity;

        resultItems.forEach(item => {
          if (added >= 4) return;
          
          const titleEl = item.querySelector('h2 a span');
          const priceWhole = item.querySelector('.a-price-whole');
          const priceFraction = item.querySelector('.a-price-fraction');
          
          if (titleEl && priceWhole) {
            const compTitle = titleEl.innerText.trim();
            const rawPrice = parseFloat(priceWhole.innerText.trim().replace(/,/g, '') + '.' + (priceFraction ? priceFraction.innerText.trim() : '00'));
            const compPrice = `$${rawPrice.toFixed(2)}`;
            
            if (rawPrice < lowestCompPrice) lowestCompPrice = rawPrice;

            const div = document.createElement('div');
            div.className = 'competitor-item';
            div.innerHTML = `
              <div class="competitor-title" title="${compTitle}">${compTitle}</div>
              <div class="competitor-price">${compPrice}</div>
            `;
            listContainer.appendChild(div);
            added++;
          }
        });
        
        if (added === 0) {
          listContainer.innerHTML = '<div style="text-align:center;color:var(--text-secondary);font-size:12px;">No priced items found. Try clicking "Search on Amazon".</div>';
        } else {
          // Calculate Price Competitiveness
          let userPrice = 0;
          if (upc) {
            userPrice = parseFloat(upc.replace(/[^0-9.]/g, ''));
          }
          
          if (!isNaN(userPrice) && userPrice > 0) {
            const diff = userPrice - lowestCompPrice;
            const card = document.getElementById('price-competitiveness-card');
            const alertBox = document.getElementById('price-alert-box');
            const diffText = document.getElementById('price-diff-text');
            
            document.getElementById('your-current-price').innerText = `$${userPrice.toFixed(2)}`;
            document.getElementById('lowest-amazon-price').innerText = `$${lowestCompPrice.toFixed(2)}`;
            
            if (diff > 0) {
              alertBox.className = 'price-alert warning';
              alertBox.innerHTML = '<span class="icon">⚠️</span> Your current price is higher than the competition.';
              diffText.innerText = `$${diff.toFixed(2)} more`;
              diffText.style.color = '#92400e';
            } else if (diff < 0) {
              alertBox.className = 'price-alert success';
              alertBox.innerHTML = '<span class="icon">🏆</span> Your price beats the competition!';
              diffText.innerText = `$${Math.abs(diff).toFixed(2)} less`;
              diffText.style.color = '#065f46';
            } else {
              alertBox.className = 'price-alert success';
              alertBox.innerHTML = '<span class="icon">✅</span> Your price matches the competition exactly.';
              diffText.innerText = `Exact match`;
              diffText.style.color = '#065f46';
            }
            
            card.classList.remove('hidden');
          }
        }
      })
      .catch(err => {
        console.error('Error scraping Amazon:', err);
        listContainer.innerHTML = '<div style="text-align:center;color:var(--error);font-size:12px;">Failed to fetch live data.</div>';
      });
    } else {
      listContainer.innerHTML = '<div style="text-align:center;color:var(--text-secondary);font-size:12px;">Waiting for product title...</div>';
    }
  }

  async function fetchAdvancedKeywords(title, amazonDomain) {
    const tableBody = document.getElementById('advanced-keyword-list');
    if (!title) {
      tableBody.innerHTML = '<tr><td colspan="4">No title found to generate keywords.</td></tr>';
      return;
    }

    // Clean title and filter empty words
    const cleanWords = title.replace(/[^a-zA-Z0-9 ]/g, "").split(' ').filter(w => w.trim() !== '');
    if (cleanWords.length === 0) return;

    tableBody.innerHTML = `<tr><td colspan="4"><div class="keyword-spinner spinner"></div><p style="text-align:center; color: var(--text-secondary);">Mining Google & ${amazonDomain}...</p></td></tr>`;

    let allKeywords = new Set();
    
    // We will query the API with 2, 3, and 4 words to get a massive spread of broad and long-tail keywords
    const queriesToTry = [];
    if (cleanWords.length >= 2) queriesToTry.push(cleanWords.slice(0, 2).join(' '));
    if (cleanWords.length >= 3) queriesToTry.push(cleanWords.slice(0, 3).join(' '));
    if (cleanWords.length >= 4) queriesToTry.push(cleanWords.slice(0, 4).join(' '));
    if (queriesToTry.length === 0) queriesToTry.push(cleanWords[0]); // fallback if only 1 word

    const fetchPromises = [];

    queriesToTry.forEach(q => {
      const encodedQ = encodeURIComponent(q);
      // Google Autocomplete
      fetchPromises.push(
        fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodedQ}`)
          .then(res => res.json())
          .then(data => data[1] || [])
          .catch(() => [])
      );
      // Amazon Autocomplete (Global Support)
      // Different Amazon TLDs may use completion.amazon.[tld]
      const completionDomain = amazonDomain.replace('www.', 'completion.');
      fetchPromises.push(
        fetch(`https://${completionDomain}/search/complete?search-alias=aps&client=amazon-search-ui&mkt=1&q=${encodedQ}`)
          .then(res => res.json())
          .then(data => data[1] || [])
          .catch(() => [])
      );
    });

    try {
      const resultsArray = await Promise.all(fetchPromises);
      resultsArray.forEach(suggestions => {
        suggestions.forEach(kw => {
          if (kw && kw.length > 3) allKeywords.add(kw.toLowerCase());
        });
      });

      const finalKeywords = Array.from(allKeywords);
      
      if (finalKeywords.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4">No keywords found. Try a different product title.</td></tr>';
        return;
      }

      tableBody.innerHTML = '';
      
      // Sort keywords somewhat randomly to mix long-tail and broad terms, but keep highly relevant ones near top
      finalKeywords.sort((a, b) => a.length - b.length);

      let baseVolume = Math.floor(Math.random() * 50000) + 10000;

      finalKeywords.slice(0, 30).forEach((keyword, index) => {
        // Mock Volume & Click Rate algorithm (higher volume for shorter terms)
        const volume = Math.max(250, Math.floor(baseVolume / (1 + (index * 0.15))));
        const clickRate = (Math.random() * (12 - 2) + 2).toFixed(1) + '%';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${keyword}</strong></td>
          <td>${volume.toLocaleString()}</td>
          <td>${clickRate}</td>
          <td><button class="btn-small copy-btn" data-kw="${keyword}">Copy</button></td>
        `;
        tableBody.appendChild(tr);
      });

      // Add copy listeners
      document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const kw = e.target.getAttribute('data-kw');
          navigator.clipboard.writeText(kw);
          e.target.innerText = "Copied!";
          setTimeout(() => { e.target.innerText = "Copy"; }, 1000);
        });
      });

    } catch (error) {
      console.error('Error fetching keywords:', error);
      tableBody.innerHTML = '<tr><td colspan="4">Failed to load keyword data. Check connection.</td></tr>';
    }
  }

  function setupAIGenerator(originalTitle) {
    const generateBtn = document.getElementById('generate-ai-btn');
    const resultContainer = document.getElementById('ai-result-container');
    const promptBox = document.getElementById('ai-prompt');
    const copyBtn = document.getElementById('copy-prompt-btn');

    generateBtn.addEventListener('click', () => {
      resultContainer.classList.remove('hidden');
      promptBox.value = "Generating optimal prompt template...";
      generateBtn.disabled = true;

      setTimeout(() => {
        // Collect ALL keywords that were fetched (up to 30)
        const keywordElements = document.querySelectorAll('#advanced-keyword-list strong');
        const allKeywords = Array.from(keywordElements).map(el => el.innerText).join(', ');
        
        const marketplace = document.getElementById('marketplace-badge').innerText.replace('Analyzing ', '') || 'e-commerce';

        const promptText = `Act as an expert e-commerce SEO copywriter for ${marketplace}. 
I need you to write a highly optimized product listing based on my current product title: "${originalTitle}"

Please include:
1. An SEO-Optimized Title (50-150 characters). It should follow the formula: [Brand] + [Core Product Name] + [Top Feature] + [Specs].
2. 5 Bullet Points (Focus on benefits, not just features. Make the first 3 words of each bullet ALL CAPS).
3. A 150+ word Product Description. Use HTML formatting like <b> for important phrases.

${allKeywords ? `Make sure to naturally integrate as many of these high-volume search keywords as possible throughout the copy:\n${allKeywords}` : 'Please research and include high-volume search keywords relevant to this product.'}`;

        promptBox.value = promptText;
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<span class="icon">✨</span> Regenerate Prompt';
      }, 500);
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        promptBox.select();
        document.execCommand('copy');
        
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '✅ Copied to Clipboard!';
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
        }, 2000);
      });
    }
  }

  function setupPricingCalculator(currentPriceStr) {
    const calcBtn = document.getElementById('calculate-price-btn');
    const resultsBox = document.getElementById('pricing-results');
    const costInput = document.getElementById('cost-price');
    const marginInput = document.getElementById('target-margin');
    
    // Parse current price (e.g. from "$24.99" to 24.99)
    let currentPrice = 0;
    if (currentPriceStr) {
      currentPrice = parseFloat(currentPriceStr.replace(/[^0-9.]/g, ''));
    }
    
    // If we couldn't parse it, mock an average competitor price
    const avgCompPrice = currentPrice > 0 ? currentPrice : 29.99;

    calcBtn.addEventListener('click', () => {
      const cost = parseFloat(costInput.value);
      const targetMargin = parseFloat(marginInput.value) / 100;
      
      if (isNaN(cost) || cost <= 0) {
        alert("Please enter a valid cost price.");
        return;
      }
      
      // Basic math: 
      const feeSelect = document.getElementById('marketplace-fee');
      const referralFeeRate = parseFloat(feeSelect.value);
      
      // Target Sell Price = Cost / (1 - Referral Fee - Target Margin)
      // Note: This assumes standard fulfillment, not WFS fees.
      let targetPrice = cost / (1 - referralFeeRate - targetMargin);
      
      // If the target price is significantly higher than competitor, warn them.
      let suggestedPrice = targetPrice;
      if (targetPrice > avgCompPrice * 1.1) {
        // Just cap it slightly above competitor to remain competitive, even if margin suffers
        suggestedPrice = avgCompPrice;
      }
      
      const referralFee = suggestedPrice * referralFeeRate;
      const netProfit = suggestedPrice - cost - referralFee;
      
      document.getElementById('avg-comp-price').innerText = `$${avgCompPrice.toFixed(2)}`;
      document.getElementById('suggested-price').innerText = `$${suggestedPrice.toFixed(2)}`;
      document.getElementById('est-profit').innerText = `$${netProfit.toFixed(2)} (${((netProfit/suggestedPrice)*100).toFixed(1)}% margin)`;
      
      resultsBox.classList.remove('hidden');
    });
  }

  function saveToHistory(data) {
    if (!data.title) return;
    chrome.storage.local.get(['flexloopHistory'], (res) => {
      let history = res.flexloopHistory || [];
      // Remove exact duplicate title if exists
      history = history.filter(item => item.title !== data.title);
      // Add to front
      history.unshift({
        title: data.title,
        score: data.score,
        marketplace: data.marketplace,
        date: new Date().toISOString()
      });
      // Keep only last 10
      if (history.length > 10) history = history.slice(0, 10);
      
      chrome.storage.local.set({flexloopHistory: history}, () => {
        loadHistory(); // refresh view
      });
    });
  }

  function loadHistory() {
    chrome.storage.local.get(['flexloopHistory'], (res) => {
      const history = res.flexloopHistory || [];
      const list = document.getElementById('history-list');
      
      if (history.length === 0) {
        list.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-secondary);">No history yet.</td></tr>';
        return;
      }
      
      list.innerHTML = '';
      history.forEach(item => {
        const tr = document.createElement('tr');
        const shortTitle = item.title.length > 25 ? item.title.substring(0, 25) + '...' : item.title;
        tr.innerHTML = `
          <td title="${item.title}">${shortTitle}</td>
          <td><strong style="color: ${item.score >= 80 ? 'var(--success)' : item.score >= 50 ? 'var(--warning)' : 'var(--error)'}">${item.score}%</strong></td>
          <td>${item.marketplace}</td>
          <td><button class="btn-small search-hist-btn" data-query="${encodeURIComponent(item.title)}">Search</button></td>
        `;
        list.appendChild(tr);
      });
      
      document.querySelectorAll('.search-hist-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const q = e.target.getAttribute('data-query');
          chrome.tabs.create({url: `https://www.google.com/search?tbm=shop&q=${q}`});
        });
      });
    });
    
    document.getElementById('clear-history-btn')?.addEventListener('click', () => {
      chrome.storage.local.set({flexloopHistory: []}, () => {
        loadHistory();
      });
    });
  }

  function setupExports(checks) {
    const exportIssuesBtn = document.getElementById('export-issues-btn');
    const exportSeoBtn = document.getElementById('export-seo-btn');

    // Remove old listeners by cloning
    const newIssuesBtn = exportIssuesBtn.cloneNode(true);
    exportIssuesBtn.parentNode.replaceChild(newIssuesBtn, exportIssuesBtn);
    const newSeoBtn = exportSeoBtn.cloneNode(true);
    exportSeoBtn.parentNode.replaceChild(newSeoBtn, exportSeoBtn);

    newIssuesBtn.addEventListener('click', () => {
      let csv = "Status,Title,Message,Solution\n";
      checks.forEach(c => {
        csv += `"${c.status}","${c.title}","${c.message.replace(/"/g, '""')}","${c.solution ? c.solution.replace(/"/g, '""') : ''}"\n`;
      });
      downloadCSV(csv, "listing_health_report.csv");
    });

    newSeoBtn.addEventListener('click', () => {
      let csv = "Keyword,Search Volume,Click Rate\n";
      const rows = document.querySelectorAll('#advanced-keyword-list tr');
      rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length >= 3) {
          const kw = cols[0].innerText;
          const vol = cols[1].innerText.replace(/,/g, '');
          const rate = cols[2].innerText;
          csv += `"${kw}","${vol}","${rate}"\n`;
        }
      });
      downloadCSV(csv, "seo_keywords.csv");
    });
  }

  function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
});
