document.addEventListener('DOMContentLoaded', () => {
  const loadingState = document.getElementById('loading-state');
  const resultsState = document.getElementById('results-state');
  const errorState = document.getElementById('error-state');

  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    const supported = activeTab && activeTab.url && (activeTab.url.includes('walmart.') || activeTab.url.includes('amazon.') || activeTab.url.includes('ebay.') || activeTab.url.includes('target.') || activeTab.url.includes('bestbuy.'));
    if (supported) {
      chrome.tabs.sendMessage(activeTab.id, { action: 'ANALYZE_LISTING' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          chrome.scripting.executeScript({ target: { tabId: activeTab.id }, files: ['content.js'] }, () => {
            chrome.tabs.sendMessage(activeTab.id, { action: 'ANALYZE_LISTING' }, handleResponse);
          });
        } else {
          handleResponse(response);
        }
      });
    } else {
      showError('Please open a Walmart, Amazon, eBay, Target, or Best Buy product page to analyze.');
    }
  });

  loadHistory();

  function getAmazonDomain(currentDomain) {
    if (!currentDomain) return 'www.amazon.com';
    const d = String(currentDomain).toLowerCase();
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
    return 'www.amazon.com';
  }

  function handleResponse(data) {
    if (!data || data.error) {
      showError((data && data.error) || 'Failed to analyze page. Please refresh and try again.');
      return;
    }
    loadingState.classList.add('hidden');
    resultsState.classList.remove('hidden');
    setTextById('marketplace-badge', 'Analyzing ' + (data.marketplace || 'Listing'));

    const targetAmazonDomain = getAmazonDomain(data.domain);
    renderScore(data.score, data.scoreLabel);
    renderIssues(data.checks || []);
    setupCompetitorLinks(data.title, targetAmazonDomain);
    fetchAdvancedKeywords(data.title, targetAmazonDomain);
    setupAIGenerator(data.title);
    setupPricingCalculator(data);
    saveToHistory(data);
    setupExports(data.checks || []);
  }

  function showError(msg) {
    loadingState.classList.add('hidden');
    resultsState.classList.add('hidden');
    errorState.classList.remove('hidden');
    if (msg) setTextById('error-message', msg);
  }

  function setTextById(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text == null ? '' : String(text);
  }

  function clearNode(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  function renderScore(score, scoreLabel) {
    const circle = document.getElementById('score-circle-path');
    const text = document.getElementById('score-text');
    const subtitle = document.getElementById('score-subtitle');
    const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
    if (subtitle) subtitle.textContent = scoreLabel === 'INTERNAL_HEURISTIC' ? 'Label: INTERNAL_HEURISTIC (not a guarantee)' : 'Score based on observed/extracted signals';

    setTimeout(() => {
      if (circle) {
        circle.style.strokeDasharray = `${safeScore}, 100`;
        if (safeScore >= 80) circle.style.stroke = 'var(--success)';
        else if (safeScore >= 50) circle.style.stroke = 'var(--warning)';
        else circle.style.stroke = 'var(--error)';
      }
    }, 100);

    let currentScore = 0;
    const interval = setInterval(() => {
      if (currentScore >= safeScore) {
        clearInterval(interval);
        if (text) text.textContent = `${safeScore}%`;
      } else {
        currentScore++;
        if (text) text.textContent = `${currentScore}%`;
      }
    }, 20);
  }

  function renderIssues(checks) {
    const list = document.getElementById('check-list');
    if (!list) return;
    clearNode(list);

    const ordered = (checks || []).slice().sort((a, b) => {
      const rank = { error: 0, warning: 1, success: 2 };
      return (rank[a.status] ?? 3) - (rank[b.status] ?? 3);
    });

    ordered.forEach((check) => {
      const li = document.createElement('li');
      li.className = `check-item ${check.status || 'warning'}`;

      const iconDiv = document.createElement('div');
      iconDiv.className = 'check-icon';
      iconDiv.textContent = check.status === 'error' ? '❌' : check.status === 'warning' ? '⚠️' : '✅';

      const content = document.createElement('div');
      content.className = 'check-content';

      const h4 = document.createElement('h4');
      h4.textContent = check.title || 'Check';
      const p = document.createElement('p');
      p.textContent = check.message || '';

      content.appendChild(h4);
      content.appendChild(p);

      if (check.solution) {
        const sol = document.createElement('div');
        sol.className = 'check-solution';
        const strong = document.createElement('strong');
        strong.textContent = 'Note: ';
        sol.appendChild(strong);
        sol.appendChild(document.createTextNode(check.solution));
        content.appendChild(sol);
      }

      li.appendChild(iconDiv);
      li.appendChild(content);
      list.appendChild(li);
    });
  }

  function setupCompetitorLinks(title, amazonDomain) {
    const searchAmazonBtn = document.getElementById('search-amazon-btn');
    const searchGoogleBtn = document.getElementById('search-google-btn');
    const listContainer = document.getElementById('competitors-list');
    const card = document.getElementById('price-competitiveness-card');

    if (card) card.classList.add('hidden');

    const safeTitle = title || '';
    const words = safeTitle.split(/\s+/).filter(Boolean).slice(0, 5).join(' ');
    const query = encodeURIComponent(words || safeTitle);

    if (searchAmazonBtn) {
      const clone = searchAmazonBtn.cloneNode(true);
      searchAmazonBtn.parentNode.replaceChild(clone, searchAmazonBtn);
      clone.addEventListener('click', () => {
        if (!query) return;
        chrome.tabs.create({ url: `https://${amazonDomain}/s?k=${query}` });
      });
    }
    if (searchGoogleBtn) {
      const clone = searchGoogleBtn.cloneNode(true);
      searchGoogleBtn.parentNode.replaceChild(clone, searchGoogleBtn);
      clone.addEventListener('click', () => {
        if (!query) return;
        chrome.tabs.create({ url: `https://www.google.com/search?tbm=shop&q=${query}` });
      });
    }

    if (!listContainer) return;
    clearNode(listContainer);
    const msg = document.createElement('div');
    msg.style.textAlign = 'center';
    msg.style.color = 'var(--text-secondary)';
    msg.style.fontSize = '13px';
    msg.style.padding = '20px 0';
    msg.textContent = 'Live competitor scraping is disabled in this stabilized milestone. Use the search buttons above to review competitors manually on the marketplace. Verified competitor prices: Data unavailable — no verified source.';
    listContainer.appendChild(msg);
  }

  async function fetchAdvancedKeywords(title, amazonDomain) {
    const tableBody = document.getElementById('advanced-keyword-list');
    if (!tableBody) return;
    clearNode(tableBody);

    if (!title) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.style.textAlign = 'center';
      td.textContent = 'No title found to generate keyword suggestions.';
      tr.appendChild(td);
      tableBody.appendChild(tr);
      return;
    }

    const loadingRow = document.createElement('tr');
    const loadingTd = document.createElement('td');
    loadingTd.colSpan = 4;
    loadingTd.style.textAlign = 'center';
    const spinner = document.createElement('div');
    spinner.className = 'keyword-spinner spinner';
    const p = document.createElement('p');
    p.style.textAlign = 'center';
    p.style.color = 'var(--text-secondary)';
    p.textContent = `Fetching autocomplete suggestions (Google & ${amazonDomain})...`;
    loadingTd.appendChild(spinner);
    loadingTd.appendChild(p);
    loadingRow.appendChild(loadingTd);
    tableBody.appendChild(loadingRow);

    const cleanWords = String(title).replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    const queriesToTry = [];
    if (cleanWords.length >= 2) queriesToTry.push(cleanWords.slice(0, 2).join(' '));
    if (cleanWords.length >= 3) queriesToTry.push(cleanWords.slice(0, 3).join(' '));
    if (cleanWords.length >= 4) queriesToTry.push(cleanWords.slice(0, 4).join(' '));
    if (queriesToTry.length === 0 && cleanWords[0]) queriesToTry.push(cleanWords[0]);

    const fetchPromises = [];
    queriesToTry.forEach(q => {
      const encodedQ = encodeURIComponent(q);
      fetchPromises.push(
        fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodedQ}`)
          .then(res => res.ok ? res.json() : [q, []])
          .then(data => Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [])
          .catch(() => [])
      );
      const completionDomain = String(amazonDomain || 'www.amazon.com').replace('www.', 'completion.');
      fetchPromises.push(
        fetch(`https://${completionDomain}/search/complete?search-alias=aps&client=amazon-search-ui&mkt=1&q=${encodedQ}`)
          .then(res => res.ok ? res.json() : [q, []])
          .then(data => Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [])
          .catch(() => [])
      );
    });

    try {
      const resultsArray = await Promise.all(fetchPromises);
      const seen = new Set();
      const suggestions = [];
      resultsArray.forEach(arr => {
        (arr || []).forEach(kw => {
          const v = String(kw || '').trim();
          if (!v || v.length <= 2) return;
          const key = v.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          suggestions.push(v);
        });
      });

      clearNode(tableBody);
      if (suggestions.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 4;
        td.style.textAlign = 'center';
        td.textContent = 'Data unavailable — no verified autocomplete suggestions returned.';
        tr.appendChild(td);
        tableBody.appendChild(tr);
        return;
      }

      suggestions.sort((a, b) => a.length - b.length);
      suggestions.slice(0, 30).forEach(keyword => {
        const tr = document.createElement('tr');

        const tdKw = document.createElement('td');
        const strong = document.createElement('strong');
        strong.textContent = keyword;
        tdKw.appendChild(strong);

        const tdVol = document.createElement('td');
        tdVol.textContent = 'Data unavailable — no verified source.';
        const tdCtr = document.createElement('td');
        tdCtr.textContent = 'Data unavailable — no verified source.';

        const tdAction = document.createElement('td');
        const btn = document.createElement('button');
        btn.className = 'btn-small copy-btn';
        btn.dataset.kw = keyword;
        btn.textContent = 'Copy';
        btn.addEventListener('click', () => {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(keyword).catch(() => {});
          }
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 1000);
        });
        tdAction.appendChild(btn);

        tr.appendChild(tdKw);
        tr.appendChild(tdVol);
        tr.appendChild(tdCtr);
        tr.appendChild(tdAction);
        tableBody.appendChild(tr);
      });
    } catch (e) {
      clearNode(tableBody);
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.style.textAlign = 'center';
      td.textContent = 'Data unavailable — failed to load keyword suggestions.';
      tr.appendChild(td);
      tableBody.appendChild(tr);
    }
  }

  function setupAIGenerator(originalTitle) {
    const generateBtn = document.getElementById('generate-ai-btn');
    const resultContainer = document.getElementById('ai-result-container');
    const promptBox = document.getElementById('ai-prompt');
    const copyBtn = document.getElementById('copy-prompt-btn');
    if (!generateBtn || !promptBox || !resultContainer) return;

    const newGen = generateBtn.cloneNode(true);
    generateBtn.parentNode.replaceChild(newGen, generateBtn);
    newGen.addEventListener('click', () => {
      resultContainer.classList.remove('hidden');
      promptBox.value = 'Generating prompt template...';
      newGen.disabled = true;
      setTimeout(() => {
        const keywordElements = document.querySelectorAll('#advanced-keyword-list strong');
        const allKeywords = Array.from(keywordElements).map(el => el.textContent || '').filter(Boolean).join(', ');
        const marketplace = (document.getElementById('marketplace-badge')?.textContent || '').replace('Analyzing ', '') || 'e-commerce';
        const titleText = originalTitle || '[product title not extracted]';
        const promptText = `Act as an e-commerce copywriting assistant for ${marketplace}.
I need a draft product listing based on this product title: "${titleText}"

Please include:
1. A clear, accurate SEO-informed title suggestion (avoid guarantees about ranking or conversion).
2. 5 bullet points focused on factual benefits and features.
3. A 150+ word product description using simple HTML formatting like <b> for emphasis.

${allKeywords ? `If relevant, naturally incorporate some of these autocomplete keyword suggestions (suggestions only, not measured search volume):\n${allKeywords}` : 'If relevant, incorporate appropriate keyword suggestions based on the product.'}

Important: do not invent product specs, certifications, pricing, reviews, or performance guarantees.`;
        promptBox.value = promptText;
        newGen.disabled = false;
        newGen.textContent = 'Regenerate Prompt';
      }, 200);
    });

    if (copyBtn) {
      const newCopy = copyBtn.cloneNode(true);
      copyBtn.parentNode.replaceChild(newCopy, copyBtn);
      newCopy.addEventListener('click', () => {
        promptBox.select();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(promptBox.value).catch(() => {});
        } else {
          document.execCommand('copy');
        }
        const originalText = newCopy.textContent;
        newCopy.textContent = 'Copied to clipboard';
        setTimeout(() => { newCopy.textContent = originalText; }, 1500);
      });
    }
  }

  function setupPricingCalculator(analysisData) {
    const calcBtn = document.getElementById('calculate-price-btn');
    const resultsBox = document.getElementById('pricing-results');
    const costInput = document.getElementById('cost-price');
    const marginInput = document.getElementById('target-margin');
    const feeInput = document.getElementById('marketplace-fee-percent');
    if (!calcBtn || !resultsBox) return;

    const newBtn = calcBtn.cloneNode(true);
    calcBtn.parentNode.replaceChild(newBtn, calcBtn);

    setTextById('avg-comp-price', 'Data unavailable — no verified source.');
    setTextById('observed-price', formatObservedPrice(analysisData && analysisData.price));

    newBtn.addEventListener('click', () => {
      const cost = parseFloat(costInput && costInput.value);
      const targetMargin = parseFloat(marginInput && marginInput.value);
      const feePercent = parseFloat(feeInput && feeInput.value);

      const status = computeCustomPricingScenario({ cost, targetMarginPercent: targetMargin, feePercent });
      if (!status.ok) {
        setTextById('pricing-status', status.message);
        setTextById('suggested-price', 'Unavailable');
        setTextById('est-profit', 'Unavailable');
        resultsBox.classList.remove('hidden');
        return;
      }
      setTextById('pricing-status', 'Custom scenario only (user-entered assumptions). Not a verified marketplace recommendation.');
      setTextById('suggested-price', `$${status.suggestedPrice.toFixed(2)}`);
      setTextById('est-profit', `$${status.estimatedProfit.toFixed(2)} (${status.marginPercent.toFixed(1)}% estimated margin in this scenario)`);
      resultsBox.classList.remove('hidden');
    });
  }

  function computeCustomPricingScenario(inputs) {
    const hasCost = typeof inputs.cost === 'number' && isFinite(inputs.cost) && inputs.cost > 0;
    const hasFee = typeof inputs.feePercent === 'number' && isFinite(inputs.feePercent) && inputs.feePercent >= 0 && inputs.feePercent < 100;
    const hasMargin = typeof inputs.targetMarginPercent === 'number' && isFinite(inputs.targetMarginPercent);
    if (!hasCost || !hasFee || !hasMargin) {
      return { ok: false, message: 'Pricing unavailable/incomplete: enter a valid cost, custom fee %, and target margin %.' };
    }
    const feeRate = inputs.feePercent / 100;
    const marginRate = inputs.targetMarginPercent / 100;
    const denom = 1 - feeRate - marginRate;
    if (denom <= 0) {
      return { ok: false, message: 'Pricing unavailable: fee and margin assumptions leave no valid price in this scenario.' };
    }
    const suggestedPrice = inputs.cost / denom;
    const estimatedFee = suggestedPrice * feeRate;
    const estimatedProfit = suggestedPrice - inputs.cost - estimatedFee;
    return { ok: true, suggestedPrice, estimatedFee, estimatedProfit, marginPercent: (estimatedProfit / suggestedPrice) * 100 };
  }

  function formatObservedPrice(priceObj) {
    if (!priceObj || !priceObj.status) return 'Data unavailable — no verified source.';
    if (priceObj.status === 'OBSERVED' && priceObj.value) return String(priceObj.value);
    return `Data unavailable — ${priceObj.status}.`;
  }

  function saveToHistory(data) {
    if (!data || !data.title) return;
    if (!chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get(['flexloopHistory'], (res) => {
      let history = (res && res.flexloopHistory) || [];
      history = history.filter(item => item.title !== data.title);
      history.unshift({
        title: data.title,
        score: data.score,
        scoreLabel: data.scoreLabel || 'INTERNAL_HEURISTIC',
        marketplace: data.marketplace || 'Unknown',
        date: new Date().toISOString()
      });
      if (history.length > 10) history = history.slice(0, 10);
      chrome.storage.local.set({ flexloopHistory: history }, () => loadHistory());
    });
  }

  function loadHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;
    if (!chrome.storage || !chrome.storage.local) {
      renderHistory([]);
      return;
    }
    chrome.storage.local.get(['flexloopHistory'], (res) => {
      renderHistory((res && res.flexloopHistory) || []);
    });

    const clearBtn = document.getElementById('clear-history-btn');
    if (clearBtn) {
      const newClear = clearBtn.cloneNode(true);
      clearBtn.parentNode.replaceChild(newClear, clearBtn);
      newClear.addEventListener('click', () => {
        chrome.storage.local.set({ flexloopHistory: [] }, () => renderHistory([]));
      });
    }
  }

  function renderHistory(history) {
    const list = document.getElementById('history-list');
    if (!list) return;
    clearNode(list);
    if (!history || history.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.style.textAlign = 'center';
      td.style.color = 'var(--text-secondary)';
      td.textContent = 'No history yet.';
      tr.appendChild(td);
      list.appendChild(tr);
      return;
    }
    history.forEach(item => {
      const tr = document.createElement('tr');
      const shortTitle = item.title && item.title.length > 25 ? item.title.substring(0, 25) + '...' : (item.title || '');
      const tdTitle = document.createElement('td');
      tdTitle.title = item.title || '';
      tdTitle.textContent = shortTitle;

      const tdScore = document.createElement('td');
      const strong = document.createElement('strong');
      const s = Number(item.score) || 0;
      strong.style.color = s >= 80 ? 'var(--success)' : s >= 50 ? 'var(--warning)' : 'var(--error)';
      strong.textContent = `${s}%`;
      tdScore.appendChild(strong);

      const tdMarket = document.createElement('td');
      tdMarket.textContent = item.marketplace || '';

      const tdAction = document.createElement('td');
      const btn = document.createElement('button');
      btn.className = 'btn-small search-hist-btn';
      btn.textContent = 'Search';
      btn.addEventListener('click', () => {
        const q = encodeURIComponent(item.title || '');
        chrome.tabs.create({ url: `https://www.google.com/search?tbm=shop&q=${q}` });
      });
      tdAction.appendChild(btn);

      tr.appendChild(tdTitle);
      tr.appendChild(tdScore);
      tr.appendChild(tdMarket);
      tr.appendChild(tdAction);
      list.appendChild(tr);
    });
  }

  function setupExports(checks) {
    const exportIssuesBtn = document.getElementById('export-issues-btn');
    const exportSeoBtn = document.getElementById('export-seo-btn');
    if (exportIssuesBtn) {
      const n = exportIssuesBtn.cloneNode(true);
      exportIssuesBtn.parentNode.replaceChild(n, exportIssuesBtn);
      n.addEventListener('click', () => {
        let csv = 'Status,Title,Message,Solution\n';
        (checks || []).forEach(c => {
          csv += `"${safeCsv(c.status)}","${safeCsv(c.title)}","${safeCsv(c.message)}","${safeCsv(c.solution || '')}"\n`;
        });
        downloadCSV(csv, 'listing_health_report.csv');
      });
    }
    if (exportSeoBtn) {
      const n = exportSeoBtn.cloneNode(true);
      exportSeoBtn.parentNode.replaceChild(n, exportSeoBtn);
      n.addEventListener('click', () => {
        let csv = 'Keyword,SuggestionStatus,SearchVolume,ClickRate\n';
        const rows = document.querySelectorAll('#advanced-keyword-list tr');
        rows.forEach(row => {
          const cols = row.querySelectorAll('td');
          if (cols.length >= 3) {
            const kw = cols[0].textContent || '';
            csv += `"${safeCsv(kw)}","SUGGESTION_ONLY","Data unavailable — no verified source","Data unavailable — no verified source"\n`;
          }
        });
        downloadCSV(csv, 'seo_keyword_suggestions.csv');
      });
    }
  }

  function safeCsv(val) {
    return String(val == null ? '' : val).replace(/"/g, '""');
  }

  function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});
