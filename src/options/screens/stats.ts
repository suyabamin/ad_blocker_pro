// src/options/screens/stats.ts
// Stats screen: 30-day bar chart and reset (02_AppFlow §3, 05_Schema §2.5)

import { sendMessage } from '../../shared/messages.js';
import type { StatsDailyRow } from '../../shared/types.js';
import { showToast } from '../../popup/view.js';
import { createIconElement } from '../../ui/icons.js';

export async function renderStatsScreen(container: HTMLElement): Promise<void> {
  const statsRes = await sendMessage<StatsDailyRow[]>({
    type: 'GET_STATS_HISTORY',
  });
  const stats = (statsRes.ok ? statsRes.data : []).slice(0, 30);

  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = 'var(--space-4)';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'flex-start';

  const headerText = document.createElement('div');
  const title = document.createElement('h1');
  title.textContent = 'Statistics';
  title.style.fontSize = 'var(--text-h1-size)';
  title.style.fontWeight = 'var(--text-h1-weight)';
  headerText.appendChild(title);

  const desc = document.createElement('p');
  desc.textContent = 'Blocked requests and hidden cosmetic elements over the past 30 days.';
  desc.style.color = 'var(--color-text-muted)';
  desc.style.fontSize = 'var(--text-small-size)';
  desc.style.marginTop = 'var(--space-1)';
  headerText.appendChild(desc);
  header.appendChild(headerText);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn btn-secondary btn-sm';
  resetBtn.appendChild(createIconElement('trash'));
  const resetText = document.createElement('span');
  resetText.textContent = 'Reset Stats';
  resetBtn.appendChild(resetText);

  resetBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all historical blocking statistics?')) {
      await sendMessage({ type: 'RESET_STATS' });
      showToast('Statistics reset');
      renderStatsScreen(container);
    }
  });

  header.appendChild(resetBtn);
  wrapper.appendChild(header);

  // Summary Totals Card
  let totalNetwork = 0;
  let totalCosmetic = 0;
  let totalYoutube = 0;

  for (const s of stats) {
    totalNetwork += s.networkBlocked || 0;
    totalCosmetic += s.cosmeticHidden || 0;
    totalYoutube += s.youtubeAdsSkipped || 0;
  }

  const totalsCard = document.createElement('div');
  totalsCard.className = 'card';
  totalsCard.style.display = 'grid';
  totalsCard.style.gridTemplateColumns = 'repeat(3, 1fr)';
  totalsCard.style.gap = 'var(--space-4)';
  totalsCard.style.textAlign = 'center';

  totalsCard.appendChild(createStatSummaryCol('Network Requests', totalNetwork));
  totalsCard.appendChild(createStatSummaryCol('Cosmetic Hidden', totalCosmetic));
  totalsCard.appendChild(createStatSummaryCol('YouTube Ads Skipped', totalYoutube));
  wrapper.appendChild(totalsCard);

  // SVG Chart Card
  const chartCard = document.createElement('div');
  chartCard.className = 'card';
  chartCard.style.padding = 'var(--space-5)';

  const chartTitle = document.createElement('h2');
  chartTitle.textContent = 'Daily Activity (Last 30 Days)';
  chartTitle.style.fontSize = 'var(--text-h2-size)';
  chartTitle.style.marginBottom = 'var(--space-4)';
  chartCard.appendChild(chartTitle);

  if (stats.length === 0 || (totalNetwork === 0 && totalCosmetic === 0 && totalYoutube === 0)) {
    const emptyNotice = document.createElement('div');
    emptyNotice.style.padding = 'var(--space-6) 0';
    emptyNotice.style.textAlign = 'center';
    emptyNotice.style.color = 'var(--color-text-muted)';
    emptyNotice.textContent = 'No data yet. Browse a few pages to record statistics.';
    chartCard.appendChild(emptyNotice);
  } else {
    // Generate Pure SVG Bar Chart
    const svg = generateStatsSvg(stats);
    chartCard.appendChild(svg);
  }

  wrapper.appendChild(chartCard);
  container.appendChild(wrapper);
}

function createStatSummaryCol(label: string, count: number): HTMLElement {
  const col = document.createElement('div');
  const num = document.createElement('div');
  num.className = 'tabular-nums';
  num.textContent = count.toLocaleString();
  num.style.fontSize = 'var(--text-h1-size)';
  num.style.fontWeight = '700';
  num.style.color = 'var(--color-primary)';
  col.appendChild(num);

  const lbl = document.createElement('div');
  lbl.textContent = label;
  lbl.style.fontSize = 'var(--text-small-size)';
  lbl.style.color = 'var(--color-text-muted)';
  lbl.style.marginTop = 'var(--space-1)';
  col.appendChild(lbl);

  return col;
}

function generateStatsSvg(stats: StatsDailyRow[]): SVGElement {
  // SVG Dimensions
  const width = 640;
  const height = 180;
  const padding = 30;

  // Find max daily count
  let maxDaily = 1;
  for (const s of stats) {
    const dayTotal = (s.networkBlocked || 0) + (s.cosmeticHidden || 0) + (s.youtubeAdsSkipped || 0);
    if (dayTotal > maxDaily) maxDaily = dayTotal;
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.style.overflow = 'visible';

  // Display chronologically (oldest to newest)
  const displayStats = [...stats].reverse();
  const barWidth = Math.max(6, Math.floor((width - padding * 2) / Math.max(displayStats.length, 14)) - 4);

  displayStats.forEach((day, index) => {
    const total = (day.networkBlocked || 0) + (day.cosmeticHidden || 0) + (day.youtubeAdsSkipped || 0);
    const barHeight = Math.max(4, Math.round((total / maxDaily) * (height - padding * 2)));

    const x = padding + index * (barWidth + 4);
    const y = height - padding - barHeight;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(barWidth));
    rect.setAttribute('height', String(barHeight));
    rect.setAttribute('rx', '3');
    rect.setAttribute('fill', 'var(--color-primary)');

    // Title tooltip
    const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    titleEl.textContent = `${day.date}: ${total.toLocaleString()} items blocked`;
    rect.appendChild(titleEl);

    svg.appendChild(rect);
  });

  return svg;
}
