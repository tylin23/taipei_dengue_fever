// 全域變數
let allData = [];
let filteredData = [];
let charts = {};

// 排序相關變數
let currentSortColumn = null;
let currentSortDirection = 'asc';

// 行政區對應
const districtMapping = {
    '北投區': 'beitou',
    '士林區': 'shilin', 
    '內湖區': 'neihu',
    '松山區': 'songshan',
    '中山區': 'zhongshan',
    '大同區': 'datong',
    '萬華區': 'wanhua',
    '中正區': 'zhongzheng',
    '大安區': 'daan',
    '信義區': 'xinyi',
    '南港區': 'nangang',
    '文山區': 'wenshan'
};

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
    setupEventListeners();
    await loadData();
    await loadSVGMap();
});

// 動態檢測可用的CSV檔案
async function detectAvailableFiles() {
    const years = [114, 113, 115]; // 可能的年份
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // 所有月份
    
    // 建立所有可能的檔案檢測任務
    const checkTasks = [];
    for (const year of years) {
        for (const month of months) {
            const filename = `data/臺北市${year}年${month}月登革熱病媒蚊密度調查結果表.csv`;
            checkTasks.push(
                fetch(filename, { method: 'HEAD' })
                    .then(response => response.ok ? { year, month, filename } : null)
                    .catch(() => null)
            );
        }
    }
    
    // 並行執行所有檢測任務
    const results = await Promise.all(checkTasks);
    
    // 過濾出存在的檔案
    return results.filter(result => result !== null);
}

// 載入所有CSV資料
async function loadData() {
    try {
        // 顯示載入狀態
        updateLoadingStatus('正在檢測可用檔案...', 0);
        
        // 動態檢測可用檔案
        const availableFiles = await detectAvailableFiles();
        
        if (availableFiles.length === 0) {
            throw new Error('找不到任何資料檔案');
        }
        
        updateLoadingStatus(`找到 ${availableFiles.length} 個檔案，開始載入...`, 20);
        
        // 更新頁面標題資訊
        updateDataRangeInfo(availableFiles);
        
        // 載入所有可用檔案，添加進度追蹤
        const loadedData = [];
        const totalFiles = availableFiles.length;
        
        for (let i = 0; i < totalFiles; i++) {
            const file = availableFiles[i];
            const progress = 20 + (i / totalFiles) * 60; // 20-80%
            
            updateLoadingStatus(`載入中... (${i + 1}/${totalFiles})`, progress);
            
            try {
                const response = await fetch(file.filename);
                const text = await response.text();
                const data = parseCSV(text, file.month, file.year);
                loadedData.push(...data);
            } catch (error) {
                console.warn(`載入檔案失敗: ${file.filename}`, error);
            }
        }
        
        allData = loadedData;
        filteredData = [...allData];
        
        updateLoadingStatus('正在初始化介面...', 85);
        
        // 動態更新月份選擇器
        updateMonthSelect(availableFiles);
        
        populateDistrictSelect();
        
        updateLoadingStatus('載入完成！', 100);
        
        // 短暫延遲後隱藏進度條並顯示最終資訊
        setTimeout(() => {
            updateDataRangeInfo(availableFiles);
        }, 500);
        
        updateDashboard();
    } catch (error) {
        console.error('載入資料時發生錯誤:', error);
        showError('無法載入資料，請檢查檔案是否存在。');
    }
}

// 更新載入狀態
function updateLoadingStatus(message, progress = 0) {
    const infoElement = document.getElementById('dataRangeInfo');
    if (infoElement) {
        infoElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="flex: 1;">
                    <div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">${message}</div>
                    <div style="width: 100%; height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden;">
                        <div style="width: ${progress}%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); transition: width 0.3s ease;"></div>
                    </div>
                </div>
                <div style="font-size: 12px; color: #9ca3af; min-width: 40px; text-align: right;">${Math.round(progress)}%</div>
            </div>
        `;
    }
}

// 更新資料範圍資訊
function updateDataRangeInfo(availableFiles) {
    if (availableFiles.length === 0) return;
    
    // 排序檔案以取得範圍
    availableFiles.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
    });
    
    const firstFile = availableFiles[0];
    const lastFile = availableFiles[availableFiles.length - 1];
    
    let rangeText;
    if (firstFile.year === lastFile.year) {
        if (firstFile.month === lastFile.month) {
            rangeText = `${firstFile.year}年${firstFile.month}月病媒蚊密度調查結果`;
        } else {
            rangeText = `${firstFile.year}年${firstFile.month}月至${lastFile.month}月病媒蚊密度調查結果`;
        }
    } else {
        rangeText = `${firstFile.year}年${firstFile.month}月至${lastFile.year}年${lastFile.month}月病媒蚊密度調查結果`;
    }
     
    const infoElement = document.getElementById('dataRangeInfo');
    if (infoElement) {
        infoElement.textContent = rangeText;
    }
}

// 動態更新月份選擇器
function updateMonthSelect(availableFiles) {
    const monthSelect = document.getElementById('monthSelect');
    if (!monthSelect) return;
    
    // 清空現有選項（保留"全部月份"）
    monthSelect.innerHTML = '<option value="all">全部月份</option>';
    
    // 取得所有可用的年月組合
    const yearMonths = availableFiles.map(file => ({
        year: file.year,
        month: file.month,
        display: `${file.year}年${file.month}月`
    }));
    
    // 排序（由近到遠）
    yearMonths.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
    });
    
    // 添加選項
    yearMonths.forEach(ym => {
        const option = document.createElement('option');
        option.value = `${ym.year}-${ym.month}`;
        option.textContent = ym.display;
        monthSelect.appendChild(option);
    });
}

// 解析CSV資料
function parseCSV(text, month, year = 114) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',');
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index] ? values[index].trim() : '';
            });
            row.month = month;
            row.year = year;
            data.push(row);
        }
    }
    
    return data;
}

// 設定事件監聽器
function setupEventListeners() {
    document.getElementById('monthSelect').addEventListener('change', filterData);
    document.getElementById('districtSelect').addEventListener('change', filterData);
    setupTableSorting();
    setupInfoIconTooltips();
}

// 設定資訊圖示 tooltip 點擊功能
function setupInfoIconTooltips() {
    const infoIcons = document.querySelectorAll('.info-icon-custom');
    
    // 檢測是否為觸控設備
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const hasHover = window.matchMedia('(hover: hover)').matches;
    
    infoIcons.forEach(icon => {
        if (isTouchDevice || !hasHover) {
            // 觸控設備：使用點擊事件
            icon.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // 關閉其他已開啟的 tooltip
                infoIcons.forEach(otherIcon => {
                    if (otherIcon !== this) {
                        otherIcon.classList.remove('active');
                    }
                });
                
                // 切換當前 tooltip
                this.classList.toggle('active');
            });
            
            // 觸控事件支援
            icon.addEventListener('touchstart', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // 關閉其他已開啟的 tooltip
                infoIcons.forEach(otherIcon => {
                    if (otherIcon !== this) {
                        otherIcon.classList.remove('active');
                    }
                });
                
                // 切換當前 tooltip
                this.classList.toggle('active');
            });
        } else {
            // 桌面設備：使用 hover 事件，但添加 mouseleave 確保 tooltip 消失
            icon.addEventListener('mouseenter', function() {
                // 移除所有 active 類別，讓 CSS hover 生效
                infoIcons.forEach(otherIcon => {
                    otherIcon.classList.remove('active');
                });
            });
            
            icon.addEventListener('mouseleave', function() {
                // 確保 tooltip 消失
                this.classList.remove('active');
            });
            
            // 桌面版也支援點擊，但行為不同
            icon.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // 桌面版點擊時，如果已經 hover 顯示，則切換 active 狀態
                // 這樣可以讓用戶"固定"顯示 tooltip
                this.classList.toggle('active');
            });
        }
    });
    
    // 點擊其他地方時關閉所有 active tooltip
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.info-icon-custom')) {
            infoIcons.forEach(icon => {
                icon.classList.remove('active');
            });
        }
    });
    
    // 觸控其他地方時關閉所有 active tooltip
    if (isTouchDevice) {
        document.addEventListener('touchstart', function(e) {
            if (!e.target.closest('.info-icon-custom')) {
                infoIcons.forEach(icon => {
                    icon.classList.remove('active');
                });
            }
        });
    }
}

// 填充行政區選擇器
function populateDistrictSelect() {
    const districts = [...new Set(allData.map(d => d['區別']))].filter(d => d).sort();
    const select = document.getElementById('districtSelect');
    
    // 清空現有選項（保留"全部行政區"）
    select.innerHTML = '<option value="all">全部行政區</option>';
    
    // 添加動態檢測到的行政區
    districts.forEach(district => {
        const option = document.createElement('option');
        option.value = district;
        option.textContent = district;
        select.appendChild(option);
    });
    
    console.log(`✅ 動態生成 ${districts.length} 個行政區選項:`, districts);
}

// 過濾資料
function filterData() {
    const selectedMonth = document.getElementById('monthSelect').value;
    const selectedDistrict = document.getElementById('districtSelect').value;
    
    filteredData = allData.filter(row => {
        let monthMatch = selectedMonth === 'all';
        
        if (!monthMatch && selectedMonth.includes('-')) {
            // 處理年月組合格式 "年-月"
            const [year, month] = selectedMonth.split('-');
            monthMatch = row.year.toString() === year && row.month.toString() === month;
        } else if (!monthMatch) {
            // 處理純月份格式（向後相容）
            monthMatch = row.month.toString() === selectedMonth;
        }
        
        const districtMatch = selectedDistrict === 'all' || row['區別'] === selectedDistrict;
        return monthMatch && districtMatch;
    });
    
    updateDashboard();
    
    // 更新地圖高亮
    if (selectedDistrict !== 'all' && districtMapping[selectedDistrict]) {
        highlightDistrict(districtMapping[selectedDistrict]);
    } else {
        highlightDistrict('all');
    }
}

// 更新儀表板
function updateDashboard() {
    updateSummaryCards();
    updateCharts();
    updateDataTable();
    updateMapColors();
}

// 更新摘要卡片
function updateSummaryCards() {
    const totalHouseholds = filteredData.reduce((sum, row) => 
        sum + parseInt(row['調查戶數'] || 0), 0);
    
    const positiveHouseholds = filteredData.reduce((sum, row) => 
        sum + parseInt(row['陽性戶數'] || 0), 0);
    
    const avgBreteau = filteredData.length > 0 ? 
        filteredData.reduce((sum, row) => sum + parseFloat(row['布氏指數'] || 0), 0) / filteredData.length : 0;
    
    const avgContainer = filteredData.length > 0 ? 
        filteredData.reduce((sum, row) => sum + parseFloat(row['容器指數'] || 0), 0) / filteredData.length : 0;
    
    // 計算月份間變化
    const changes = calculateMonthlyChanges();
    
    // 更新數值
    document.getElementById('totalHouseholds').textContent = totalHouseholds.toLocaleString();
    document.getElementById('positiveHouseholds').textContent = positiveHouseholds.toLocaleString();
    document.getElementById('avgBreteauIndex').textContent = avgBreteau.toFixed(1);
    document.getElementById('avgContainerIndex').textContent = avgContainer.toFixed(1);
    
    // 更新變化指標
    updateChangeIndicators(changes);
}

// 計算月份間變化
function calculateMonthlyChanges() {
    const selectedMonth = document.getElementById('monthSelect').value;
    const selectedDistrict = document.getElementById('districtSelect').value;
    
    if (selectedMonth !== 'all') {
        let currentYear, currentMonth, previousYear, previousMonth;
        
        // 處理新的年月格式 "年-月"
        if (selectedMonth.includes('-')) {
            [currentYear, currentMonth] = selectedMonth.split('-').map(Number);
            
            // 計算上個月
            if (currentMonth > 1) {
                previousYear = currentYear;
                previousMonth = currentMonth - 1;
            } else {
                previousYear = currentYear - 1;
                previousMonth = 12;
            }
        } else {
            // 向後相容：處理舊的純月份格式
            currentMonth = parseInt(selectedMonth);
            currentYear = 114; // 預設年份
            previousMonth = currentMonth - 1;
            previousYear = currentYear;
            
            if (previousMonth < 1) {
                previousMonth = 12;
                previousYear = currentYear - 1;
            }
        }
        
        // 篩選當前月份資料
        const currentData = allData.filter(row => {
            const monthMatch = row.year === currentYear && row.month === currentMonth;
            const districtMatch = selectedDistrict === 'all' || row['區別'] === selectedDistrict;
            return monthMatch && districtMatch;
        });
        
        // 篩選上個月份資料
        const previousData = allData.filter(row => {
            const monthMatch = row.year === previousYear && row.month === previousMonth;
            const districtMatch = selectedDistrict === 'all' || row['區別'] === selectedDistrict;
            return monthMatch && districtMatch;
        });
        
        if (currentData.length > 0 && previousData.length > 0) {
            // 計算當前月份統計
            const currentHouseholds = currentData.reduce((sum, row) => sum + parseInt(row['調查戶數'] || 0), 0);
            const currentPositive = currentData.reduce((sum, row) => sum + parseInt(row['陽性戶數'] || 0), 0);
            const currentBreteau = currentData.reduce((sum, row) => sum + parseFloat(row['布氏指數'] || 0), 0) / currentData.length;
            const currentContainer = currentData.reduce((sum, row) => sum + parseFloat(row['容器指數'] || 0), 0) / currentData.length;
            
            // 計算上個月份統計
            const previousHouseholds = previousData.reduce((sum, row) => sum + parseInt(row['調查戶數'] || 0), 0);
            const previousPositive = previousData.reduce((sum, row) => sum + parseInt(row['陽性戶數'] || 0), 0);
            const previousBreteau = previousData.reduce((sum, row) => sum + parseFloat(row['布氏指數'] || 0), 0) / previousData.length;
            const previousContainer = previousData.reduce((sum, row) => sum + parseFloat(row['容器指數'] || 0), 0) / previousData.length;
            
            // 計算變化百分比
            const householdsChange = previousHouseholds > 0 ? 
                ((currentHouseholds - previousHouseholds) / previousHouseholds * 100) : 0;
            
            const positiveChange = previousPositive > 0 ? 
                ((currentPositive - previousPositive) / previousPositive * 100) : 
                (currentPositive > 0 ? 100 : 0);
            
            const breteauChange = previousBreteau > 0 ? 
                ((currentBreteau - previousBreteau) / previousBreteau * 100) : 0;
            
            const containerChange = previousContainer > 0 ? 
                ((currentContainer - previousContainer) / previousContainer * 100) : 0;
            
            return {
                households: householdsChange,
                positive: positiveChange,
                breteau: breteauChange,
                container: containerChange,
                hasComparison: true,
                comparisonMonth: previousMonth,
                comparisonYear: previousYear
            };
        }
    }
    
    return { 
        households: 0, 
        positive: 0, 
        breteau: 0, 
        container: 0, 
        hasComparison: false 
    };
}

// 更新變化指標
function updateChangeIndicators(changes) {
    const cards = document.querySelectorAll('.card');
    
    if (changes.hasComparison) {
        // 總調查戶數卡片
        if (cards[0]) {
            const householdsChange = cards[0].querySelector('.metric-change');
            if (householdsChange) {
                const changeText = changes.households >= 0 ? 
                    `+${changes.households.toFixed(1)}%` : `${changes.households.toFixed(1)}%`;
                householdsChange.textContent = `${changeText} 較上月`;
                householdsChange.style.color = changes.households >= 0 ? '#10b981' : '#ef4444';
            }
        }
        
        // 陽性戶數卡片
        if (cards[1]) {
            const positiveChange = cards[1].querySelector('.metric-change');
            if (positiveChange) {
                const changeText = changes.positive >= 0 ? 
                    `+${changes.positive.toFixed(1)}%` : `${changes.positive.toFixed(1)}%`;
                positiveChange.textContent = `${changeText} 較上月`;
                // 陽性戶數減少是好事，所以顏色邏輯相反
                positiveChange.style.color = changes.positive <= 0 ? '#10b981' : '#ef4444';
            }
        }
        
        // 平均布氏指數卡片
        if (cards[2]) {
            const breteauChange = cards[2].querySelector('.metric-change');
            if (breteauChange) {
                const changeText = changes.breteau >= 0 ? 
                    `+${changes.breteau.toFixed(1)}%` : `${changes.breteau.toFixed(1)}%`;
                breteauChange.textContent = `${changeText} 較上月`;
                // 布氏指數減少是好事
                breteauChange.style.color = changes.breteau <= 0 ? '#10b981' : '#ef4444';
            }
        }
        
        // 平均容器指數卡片
        if (cards[3]) {
            const containerChange = cards[3].querySelector('.metric-change');
            if (containerChange) {
                const changeText = changes.container >= 0 ? 
                    `+${changes.container.toFixed(1)}%` : `${changes.container.toFixed(1)}%`;
                containerChange.textContent = `${changeText} 較上月`;
                // 容器指數減少是好事
                containerChange.style.color = changes.container <= 0 ? '#10b981' : '#ef4444';
            }
        }
    } else {
        // 沒有比較資料時，顯示預設文字
        cards.forEach((card, index) => {
            const changeElement = card.querySelector('.metric-change');
            if (changeElement) {
                const defaultTexts = ['監測指標', '監測指標', '風險評估', '監測指標'];
                changeElement.textContent = defaultTexts[index] || '監測指標';
                changeElement.style.color = '#64748b';
            }
        });
    }
}

// 更新圖表
function updateCharts() {
    updateMonthlyTrendChart();
    updateDistrictComparisonChart();
    updateSurveyTypeChart();
}

// 更新月份趨勢圖表
function updateMonthlyTrendChart() {
    const ctx = document.getElementById('monthlyTrendChart');
    if (!ctx) return;
    
    if (charts.monthlyTrend) {
        charts.monthlyTrend.destroy();
    }
    
    const selectedDistrict = document.getElementById('districtSelect').value;
    
    // 取得所有可用的年月組合並排序
    const availableYearMonths = [...new Set(allData.map(row => `${row.year}-${row.month}`))].sort();
    
    // 根據行政區篩選資料
    const districtFilteredData = selectedDistrict === 'all' ? 
        allData : allData.filter(row => row['區別'] === selectedDistrict);
    
    // 計算每個年月的平均布氏指數
    const monthlyData = {};
    const labels = [];
    
    availableYearMonths.forEach(yearMonth => {
        const [year, month] = yearMonth.split('-').map(Number);
        const monthData = districtFilteredData.filter(row => 
            row.year === year && row.month === month
        );
        
        if (monthData.length > 0) {
            const avgBreteau = monthData.reduce((sum, row) => 
                sum + parseFloat(row['布氏指數'] || 0), 0) / monthData.length;
            monthlyData[yearMonth] = avgBreteau;
            labels.push(`${year}年${month}月`);
        }
    });
    
    // 如果沒有資料，顯示空圖表
    if (Object.keys(monthlyData).length === 0) {
        charts.monthlyTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['無資料'],
                datasets: [{
                    label: '平均布氏指數',
                    data: [0],
                    borderColor: '#d1d5db',
                    backgroundColor: 'rgba(209, 213, 219, 0.1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
        return;
    }
    
    charts.monthlyTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: selectedDistrict === 'all' ? '全市平均布氏指數' : `${selectedDistrict}平均布氏指數`,
                data: Object.values(monthlyData),
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 4,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        font: {
                            weight: 600
                        },
                        color: '#64748b'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '布氏指數',
                        font: {
                            weight: 600
                        },
                        color: '#64748b'
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    },
                    ticks: {
                        color: '#64748b',
                        font: {
                            weight: 500
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    },
                    ticks: {
                        color: '#64748b',
                        font: {
                            weight: 500
                        }
                    }
                }
            }
        }
    });
}

// 更新行政區比較圖表
function updateDistrictComparisonChart() {
    const ctx = document.getElementById('districtComparisonChart');
    if (!ctx) return;
    
    if (charts.districtComparison) {
        charts.districtComparison.destroy();
    }
    
    const districtData = {};
    Object.keys(districtMapping).forEach(district => {
        const data = filteredData.filter(row => row['區別'] === district);
        districtData[district] = data.length > 0 ? 
            data.reduce((sum, row) => sum + parseFloat(row['布氏指數'] || 0), 0) / data.length : 0;
    });
    
    charts.districtComparison = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(districtData),
            datasets: [{
                label: '平均布氏指數',
                data: Object.values(districtData),
                backgroundColor: Object.values(districtData).map(value => {
                    const color = getColorByBreteauIndex(value);
                    // 將 hex 顏色轉換為 rgba 格式
                    const hex = color.replace('#', '');
                    const r = parseInt(hex.substr(0, 2), 16);
                    const g = parseInt(hex.substr(2, 2), 16);
                    const b = parseInt(hex.substr(4, 2), 16);
                    return `rgba(${r}, ${g}, ${b}, 0.8)`;
                }),
                borderColor: Object.values(districtData).map(value => {
                    return getColorByBreteauIndex(value);
                }),
                borderWidth: 2,
                borderRadius: {
                    topRight: 4,
                    bottomRight: 4,
                    topLeft: 0,
                    bottomLeft: 0
                },
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y', // 這讓圖表變成橫向
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '布氏指數',
                        font: {
                            weight: 600
                        },
                        color: '#64748b'
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    },
                    ticks: {
                        color: '#64748b',
                        font: {
                            weight: 500
                        }
                    }
                },
                y: {
                    categoryPercentage: 0.8, // 控制類別間距
                    barPercentage: 0.6,      // 控制長條寬度
                    ticks: {
                        color: '#64748b',
                        font: {
                            weight: 500,
                            size: window.innerWidth <= 480 ? 11 : 12
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            },
            elements: {
                bar: {
                    borderWidth: 2
                }
            }
        }
    });
}

// 更新調查種類圖表
function updateSurveyTypeChart() {
    const ctx = document.getElementById('surveyTypeChart');
    if (!ctx) return;
    
    if (charts.surveyType) {
        charts.surveyType.destroy();
    }
    
    const typeData = {};
    filteredData.forEach(row => {
        const type = row['調查種類'] || '未知';
        typeData[type] = (typeData[type] || 0) + 1;
    });
    
    // 為不同調查種類分配特定顏色
    const colorMapping = {
        '住宅': { bg: 'rgba(59, 130, 246, 0.8)', border: '#3b82f6' },      // 藍色
        '菜園': { bg: 'rgba(34, 197, 94, 0.8)', border: '#22c55e' },       // 綠色
        '學校': { bg: 'rgba(245, 158, 11, 0.8)', border: '#f59e0b' },      // 橙色
        '市場': { bg: 'rgba(239, 68, 68, 0.8)', border: '#ef4444' },       // 紅色
        '公園': { bg: 'rgba(168, 85, 247, 0.8)', border: '#a855f7' },      // 紫色
        '機關': { bg: 'rgba(6, 182, 212, 0.8)', border: '#06b6d4' },       // 青色
        '山區': { bg: 'rgba(101, 163, 13, 0.8)', border: '#65a30d' },      // 深綠色
        '其他': { bg: 'rgba(156, 163, 175, 0.8)', border: '#9ca3af' },     // 灰色
        '未知': { bg: 'rgba(107, 114, 128, 0.8)', border: '#6b7280' }      // 深灰色
    };
    
    const labels = Object.keys(typeData);
    const backgroundColors = [];
    const borderColors = [];
    
    labels.forEach(label => {
        const colors = colorMapping[label] || colorMapping['未知'];
        backgroundColors.push(colors.bg);
        borderColors.push(colors.border);
    });
    
    charts.surveyType = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: Object.values(typeData),
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            weight: 500
                        },
                        color: '#64748b',
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return ` ${value} 筆 (${percentage}%)`;
                        }
                    },
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    }
                }
            },
            cutout: '60%'
        }
    });
}

// 更新資料表
function updateDataTable() {
    const tbody = document.getElementById('dataTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // 更新篩選狀態顯示
    updateTableStatus();
    
    // 如果有當前排序，使用排序後的資料；否則按日期降序排列
    let sortedData;
    if (currentSortColumn) {
        sortedData = [...filteredData].sort((a, b) => {
            return compareValues(a[currentSortColumn], b[currentSortColumn], currentSortDirection);
        });
    } else {
        sortedData = filteredData.sort((a, b) => {
            const dateA = parseInt(a['日期'] || '0');
            const dateB = parseInt(b['日期'] || '0');
            return dateB - dateA; // 降序排列，最新的在前面
        });
    }
    
    if (sortedData.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="8" style="text-align: center; color: #64748b; padding: 40px;">沒有符合條件的資料</td>';
        tbody.appendChild(tr);
        return;
    }
    
    // 根據資料量決定顯示策略
    let displayData;
    
    if (sortedData.length <= 1000) {
        // 1000筆以內直接顯示全部
        displayData = sortedData;
    } else {
        // 超過1000筆則顯示最新1000筆
        displayData = sortedData.slice(0, 1000);
    }
    
    // 顯示資料
    displayData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(row['日期'])}</td>
            <td>${row['區別']}</td>
            <td>${row['里別']}</td>
            <td>${row['調查戶數']}</td>
            <td>${row['陽性戶數']}</td>
            <td>${row['布氏指數']}</td>
            <td>${row['布氏級數']}</td>
            <td>${row['容器指數']}</td>
        `;
        tbody.appendChild(tr);
    });
    
    // 如果有排序，更新狀態顯示
    if (currentSortColumn) {
        updateTableStatusWithSort(sortedData.length, displayData.length);
    }
}

// 更新資料表狀態顯示
function updateTableStatus() {
    const statusDiv = document.getElementById('tableStatus');
    if (!statusDiv) return;
    
    const selectedMonth = document.getElementById('monthSelect').value;
    const selectedDistrict = document.getElementById('districtSelect').value;
    
    let statusText = '篩選條件: ';
    
    if (selectedMonth === 'all') {
        statusText += '全部月份';
    } else {
        statusText += `${selectedMonth}月`;
    }
    
    statusText += ' × ';
    
    if (selectedDistrict === 'all') {
        statusText += '全部行政區';
    } else {
        statusText += selectedDistrict;
    }
    
    const totalCount = allData.length;
    const filteredCount = filteredData.length;
    
    if (filteredCount <= 1000) {
        statusText += ` | 顯示全部 ${filteredCount} 筆資料`;
    } else {
        statusText += ` | 顯示最新 1000 筆資料（共 ${filteredCount} 筆）`;
    }
    
    statusText += ` | 本平台目前總資料量: ${totalCount} 筆`;
    
    statusDiv.textContent = statusText;
}

// 更新地圖顏色
function updateMapColors() {
    const selectedDistrict = document.getElementById('districtSelect').value;
    
    Object.keys(districtMapping).forEach(districtName => {
        const districtElement = document.getElementById(districtMapping[districtName]);
        if (districtElement) {
            if (selectedDistrict === 'all') {
                // 顯示全部行政區時，每個區域顯示對應的布氏指數顏色
                const summary = getDistrictSummary(districtName);
                const color = getColorByBreteauIndex(summary.avgBreteau);
                districtElement.setAttribute('fill', color);
                districtElement.style.opacity = '1';
            } else if (selectedDistrict === districtName) {
                // 選中的行政區顯示對應的布氏指數顏色
                const summary = getDistrictSummary(districtName);
                const color = getColorByBreteauIndex(summary.avgBreteau);
                districtElement.setAttribute('fill', color);
                districtElement.style.opacity = '1';
            } else {
                // 未選中的行政區顯示灰色
                districtElement.setAttribute('fill', '#d1d5db');
                districtElement.style.opacity = '0.6';
            }
        }
    });
}

// 獲取行政區摘要資料
function getDistrictSummary(districtName) {
    const districtData = filteredData.filter(row => row['區別'] === districtName);
    
    if (districtData.length === 0) {
        return { totalHouseholds: 0, positiveHouseholds: 0, avgBreteau: 0, avgContainer: 0 };
    }
    
    return {
        totalHouseholds: districtData.reduce((sum, row) => sum + parseInt(row['調查戶數'] || 0), 0),
        positiveHouseholds: districtData.reduce((sum, row) => sum + parseInt(row['陽性戶數'] || 0), 0),
        avgBreteau: districtData.reduce((sum, row) => sum + parseFloat(row['布氏指數'] || 0), 0) / districtData.length,
        avgContainer: districtData.reduce((sum, row) => sum + parseFloat(row['容器指數'] || 0), 0) / districtData.length
    };
}

// 獲取行政區摘要資料（使用所有資料，不受篩選影響）
function getDistrictSummaryFromAllData(districtName) {
    const districtData = allData.filter(row => row['區別'] === districtName);
    
    if (districtData.length === 0) {
        return { totalHouseholds: 0, positiveHouseholds: 0, avgBreteau: 0, avgContainer: 0 };
    }
    
    return {
        totalHouseholds: districtData.reduce((sum, row) => sum + parseInt(row['調查戶數'] || 0), 0),
        positiveHouseholds: districtData.reduce((sum, row) => sum + parseInt(row['陽性戶數'] || 0), 0),
        avgBreteau: districtData.reduce((sum, row) => sum + parseFloat(row['布氏指數'] || 0), 0) / districtData.length,
        avgContainer: districtData.reduce((sum, row) => sum + parseFloat(row['容器指數'] || 0), 0) / districtData.length
    };
}

// 獲取當前篩選條件下特定行政區的統計資料
function getDistrictSummaryWithCurrentFilter(districtName) {
    const selectedMonth = document.getElementById('monthSelect').value;
    
    // 根據當前篩選條件篩選該行政區的資料
    let districtData = allData.filter(row => row['區別'] === districtName);
    
    // 如果有月份篩選，進一步篩選
    if (selectedMonth !== 'all') {
        if (selectedMonth.includes('-')) {
            const [year, month] = selectedMonth.split('-');
            districtData = districtData.filter(row => 
                row.year.toString() === year && row.month.toString() === month
            );
        } else {
            // 處理純月份格式（向後相容）
            districtData = districtData.filter(row => 
                row.month.toString() === selectedMonth
            );
        }
    }
    
    if (districtData.length === 0) {
        return { totalHouseholds: 0, positiveHouseholds: 0, avgBreteau: 0, avgContainer: 0 };
    }
    
    return {
        totalHouseholds: districtData.reduce((sum, row) => sum + parseInt(row['調查戶數'] || 0), 0),
        positiveHouseholds: districtData.reduce((sum, row) => sum + parseInt(row['陽性戶數'] || 0), 0),
        avgBreteau: districtData.reduce((sum, row) => sum + parseFloat(row['布氏指數'] || 0), 0) / districtData.length,
        avgContainer: districtData.reduce((sum, row) => sum + parseFloat(row['容器指數'] || 0), 0) / districtData.length
    };
}

// 根據布氏指數獲取顏色（依據官方等級標準）
function getColorByBreteauIndex(index) {
    if (index === 0) return '#10b981';           // 0: 安全 (綠色)
    if (index <= 4) return '#22c55e';            // 1-4: 等級1 (淺綠色)
    if (index <= 9) return '#eab308';            // 5-9: 等級2 (黃色)
    if (index <= 19) return '#f59e0b';           // 10-19: 等級3 (橙色)
    if (index <= 34) return '#f97316';           // 20-34: 等級4 (深橙色)
    if (index <= 49) return '#ef4444';           // 35-49: 等級5 (紅色)
    if (index <= 74) return '#dc2626';           // 50-74: 等級6 (深紅色)
    if (index <= 99) return '#b91c1c';           // 75-99: 等級7 (暗紅色)
    if (index <= 199) return '#991b1b';          // 100-199: 等級8 (極深紅色)
    return '#7f1d1d';                            // ≥200: 等級9 (最深紅色)
}

// 格式化日期
function formatDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    
    return `${year}/${month}/${day}`;
}

// 高亮顯示行政區
function highlightDistrict(districtId) {
    document.querySelectorAll('.district').forEach(d => {
        d.classList.remove('district-selected');
    });
    
    if (districtId !== 'all') {
        const district = document.getElementById(districtId);
        if (district) {
            district.classList.add('district-selected');
        }
    }
}

// 載入SVG地圖
async function loadSVGMap() {
    try {
        const response = await fetch('taipei-districts.svg');
        const svgText = await response.text();
        document.getElementById('taipeiMap').innerHTML = svgText;
        setupMapInteractions();
        // 載入完成後立即更新地圖顏色
        updateMapColors();
    } catch (error) {
        console.error('載入地圖時發生錯誤:', error);
    }
}

// 設定地圖互動
function setupMapInteractions() {
    const districts = document.querySelectorAll('.district');
    
    districts.forEach(district => {
        district.addEventListener('click', function(e) {
            const districtId = this.id;
            const districtName = Object.keys(districtMapping).find(
                key => districtMapping[key] === districtId
            );
            
            if (districtName) {
                // 先隱藏之前的 tooltip
                hideTooltip();
                
                // 先篩選資料和高亮
                document.getElementById('districtSelect').value = districtName;
                filterData();
                highlightDistrict(districtId);
                
                // 然後顯示更新後的 tooltip
                setTimeout(() => {
                    showTooltip(e, districtId);
                }, 50);
            }
        });
        
        // 點擊其他地方時隱藏 tooltip
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.district') && !e.target.closest('.tooltip')) {
                hideTooltip();
            }
        });
    });
}

// 顯示提示框
function showTooltip(event, districtId) {
    const districtName = Object.keys(districtMapping).find(
        key => districtMapping[key] === districtId
    );
    
    if (!districtName) return;
    
    // 使用當前篩選條件下該行政區的統計資料
    const districtData = getDistrictSummaryWithCurrentFilter(districtName);
    const riskLevel = getRiskLevel(districtData.avgBreteau);
    
    // 獲取當前篩選條件資訊
    const selectedMonth = document.getElementById('monthSelect').value;
    const filterInfo = selectedMonth === 'all' ? '全部月份' : selectedMonth.replace('-', '年') + '月';
    
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.innerHTML = `
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 8px; color: #2c3e50;">
            📍 ${districtName}
        </div>
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
            📅 ${filterInfo}
        </div>
        <div style="margin-bottom: 4px;">
            📊 平均布氏指數: <strong>${districtData.avgBreteau.toFixed(1)}</strong>
        </div>
        <div style="margin-bottom: 4px;">
            🏠 總調查戶數: <strong>${districtData.totalHouseholds.toLocaleString()}</strong>
        </div>
        <div style="margin-bottom: 8px;">
            ⚠️ 陽性戶數: <strong>${districtData.positiveHouseholds.toLocaleString()}</strong>
        </div>
        <div style="padding: 4px 8px; border-radius: 8px; background: ${getRiskColor(districtData.avgBreteau)}; color: white; font-size: 12px; text-align: center;">
            ${riskLevel}
        </div>
    `;
    
    tooltip.style.left = event.pageX + 15 + 'px';
    tooltip.style.top = event.pageY - 15 + 'px';
    
    document.body.appendChild(tooltip);
    
    // 添加淡入動畫
    tooltip.style.opacity = '0';
    tooltip.style.transform = 'translateY(10px)';
    requestAnimationFrame(() => {
        tooltip.style.transition = 'all 0.3s ease';
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateY(0)';
    });
}

// 隱藏提示框
function hideTooltip() {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// 獲取風險等級文字（依據官方等級標準）
function getRiskLevel(index) {
    if (index === 0) return '安全';
    if (index <= 4) return '等級1 (極低風險)';
    if (index <= 9) return '等級2 (低風險)';
    if (index <= 19) return '等級3 (輕度風險)';
    if (index <= 34) return '等級4 (中度風險)';
    if (index <= 49) return '等級5 (中高風險)';
    if (index <= 74) return '等級6 (高風險)';
    if (index <= 99) return '等級7 (極高風險)';
    if (index <= 199) return '等級8 (嚴重風險)';
    return '等級9 (極嚴重風險)';
}

// 獲取風險顏色（依據官方等級標準）
function getRiskColor(index) {
    if (index === 0) return '#10b981';           // 0: 安全 (綠色)
    if (index <= 4) return '#22c55e';            // 1-4: 等級1 (淺綠色)
    if (index <= 9) return '#eab308';            // 5-9: 等級2 (黃色)
    if (index <= 19) return '#f59e0b';           // 10-19: 等級3 (橙色)
    if (index <= 34) return '#f97316';           // 20-34: 等級4 (深橙色)
    if (index <= 49) return '#ef4444';           // 35-49: 等級5 (紅色)
    if (index <= 74) return '#dc2626';           // 50-74: 等級6 (深紅色)
    if (index <= 99) return '#b91c1c';           // 75-99: 等級7 (暗紅色)
    if (index <= 199) return '#991b1b';          // 100-199: 等級8 (極深紅色)
    return '#7f1d1d';                            // ≥200: 等級9 (最深紅色)
}

// 顯示錯誤訊息
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4444;
        color: white;
        padding: 15px;
        border-radius: 5px;
        z-index: 1000;
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}// 設定
表格排序功能
function setupTableSorting() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    
    sortableHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const column = this.getAttribute('data-column');
            sortTable(column);
        });
    });
}

// 表格排序函數
function sortTable(column) {
    // 如果點擊的是同一列，切換排序方向
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    
    // 更新表頭樣式
    updateSortHeaders();
    
    // 執行排序
    const sortedData = [...filteredData].sort((a, b) => {
        return compareValues(a[column], b[column], currentSortDirection);
    });
    
    // 更新表格顯示
    updateDataTableWithSortedData(sortedData);
}

// 比較函數
function compareValues(a, b, direction) {
    // 處理空值
    if (!a && !b) return 0;
    if (!a) return direction === 'asc' ? 1 : -1;
    if (!b) return direction === 'asc' ? -1 : 1;
    
    // 數字比較
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    
    if (!isNaN(numA) && !isNaN(numB)) {
        return direction === 'asc' ? numA - numB : numB - numA;
    }
    
    // 日期比較 (格式: YYYYMMDD)
    if (currentSortColumn === '日期') {
        const dateA = parseInt(a) || 0;
        const dateB = parseInt(b) || 0;
        return direction === 'asc' ? dateA - dateB : dateB - dateA;
    }
    
    // 字串比較
    const strA = a.toString().toLowerCase();
    const strB = b.toString().toLowerCase();
    
    if (direction === 'asc') {
        return strA.localeCompare(strB, 'zh-TW');
    } else {
        return strB.localeCompare(strA, 'zh-TW');
    }
}

// 更新排序表頭樣式
function updateSortHeaders() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    
    sortableHeaders.forEach(header => {
        header.classList.remove('sort-asc', 'sort-desc');
        const icon = header.querySelector('.sort-icon');
        
        if (header.getAttribute('data-column') === currentSortColumn) {
            header.classList.add(`sort-${currentSortDirection}`);
            
            // 更新圖示
            if (currentSortDirection === 'asc') {
                icon.className = 'fa-solid fa-sort-up sort-icon';
            } else {
                icon.className = 'fa-solid fa-sort-down sort-icon';
            }
        } else {
            // 重置為預設排序圖示
            icon.className = 'fa-solid fa-sort sort-icon';
        }
    });
}

// 使用排序後的資料更新表格
function updateDataTableWithSortedData(sortedData) {
    const tbody = document.getElementById('dataTableBody');
    if (!tbody) return;
    
    // 添加排序動畫效果
    document.querySelector('.table-container').classList.add('sorting');
    
    setTimeout(() => {
        tbody.innerHTML = '';
        
        // 根據資料量決定顯示策略
        let displayData;
        
        if (sortedData.length <= 1000) {
            displayData = sortedData;
        } else {
            displayData = sortedData.slice(0, 1000);
        }
        
        // 顯示資料
        displayData.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDate(row['日期'])}</td>
                <td>${row['區別']}</td>
                <td>${row['里別']}</td>
                <td>${row['調查戶數']}</td>
                <td>${row['陽性戶數']}</td>
                <td>${row['布氏指數']}</td>
                <td>${row['布氏級數']}</td>
                <td>${row['容器指數']}</td>
            `;
            tbody.appendChild(tr);
        });
        
        // 移除排序動畫效果
        document.querySelector('.table-container').classList.remove('sorting');
        
        // 更新表格狀態顯示
        updateTableStatusWithSort(sortedData.length, displayData.length);
        
    }, 150); // 短暫延遲以顯示動畫效果
}

// 更新表格狀態顯示（包含排序資訊）
function updateTableStatusWithSort(totalCount, displayCount) {
    const statusDiv = document.getElementById('tableStatus');
    if (!statusDiv) return;
    
    const selectedMonth = document.getElementById('monthSelect').value;
    const selectedDistrict = document.getElementById('districtSelect').value;
    
    let statusText = '篩選條件： ';
    
    if (selectedMonth === 'all') {
        statusText += '全部月份';
    } else {
        statusText += `${selectedMonth}月`;
    }
    
    statusText += ' × ';
    
    if (selectedDistrict === 'all') {
        statusText += '全部行政區';
    } else {
        statusText += selectedDistrict;
    }
    
    // 添加排序資訊
    if (currentSortColumn) {
        const columnNames = {
            '日期': '日期',
            '區別': '行政區',
            '里別': '里別',
            '調查戶數': '調查戶數',
            '陽性戶數': '陽性戶數',
            '布氏指數': '布氏指數',
            '布氏級數': '布氏級數',
            '容器指數': '容器指數'
        };
        
        const sortDirection = currentSortDirection === 'asc' ? '升序' : '降序';
        statusText += ` | 排序: ${columnNames[currentSortColumn]} (${sortDirection})`;
    }
    
    if (displayCount <= 1000) {
        statusText += `  |  顯示全部 ${displayCount} 筆資料`;
    } else {
        statusText += `  |  顯示前 1000 筆資料（共 ${totalCount} 筆）`;
    }
    
    statusText += `  |  本平台目前總資料量: ${allData.length} 筆`;
    
    statusDiv.textContent = statusText;
}

// 重置排序狀態
function resetSorting() {
    currentSortColumn = null;
    currentSortDirection = 'asc';
    updateSortHeaders();
}