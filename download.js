(function () {
    'use strict';

    // ========== UTILITIES ==========
    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
            return true;
        }
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        return true;
    }

    function formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '';
        var sizes = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
    }

    // ========== STORAGE ==========
    var savedCard = null;

    // ========== FILENAME GENERATOR ==========
    function getFilename(quality) {
        var parts = [];
        var card = savedCard;

        if (!card) {
            try {
                var a = Lampa.Activity.active();
                if (a && a.card) card = a.card;
            } catch (e) {}
        }

        if (card) {
            parts.push(card.title || card.name || '');
        }

        try {
            var pd = Lampa.Player.playdata();
            if (pd && (pd.season || pd.episode)) {
                var se = 'S' + String(pd.season || 1).padStart(2, '0') + 'E' + String(pd.episode || 1).padStart(2, '0');
                parts.push(se);
                if (pd.title && pd.title !== (card && card.title)) {
                    parts.push(pd.title);
                }
            }
        } catch (e) {}

        if (quality) parts.push(quality);

        var filename = parts
            .filter(function(p) { return p && p.length > 0; })
            .join(' - ')
            .replace(/[<>:"/\\|?*]/g, '')
            .trim();

        return filename || 'video';
    }

    // ========== GET CURRENT URL ==========
    function getCurrentUrl() {
        // Try Lampa.Player.playdata()
        try {
            var pd = Lampa.Player.playdata();
            if (pd && pd.url && typeof pd.url === 'string' && pd.url.indexOf('http') === 0) {
                return pd.url;
            }
        } catch (e) {}

        // Try video element
        try {
            var v = document.querySelector('video');
            if (v && v.src && v.src.indexOf('http') === 0) {
                return v.src;
            }
        } catch (e) {}

        return null;
    }

    // ========== EXTRACT QUALITY FROM URL ==========
    function extractQualityFromUrl(url) {
        if (!url) return null;
        var patterns = [
            /[_\/\-](\d{3,4}p)[_\/\.\-]/i,
            /quality[=_]?(\d{3,4})/i,
            /[_\/\-](\d{3,4})[_\/\.\-]/
        ];
        for (var i = 0; i < patterns.length; i++) {
            var match = url.match(patterns[i]);
            if (match) {
                var q = match[1];
                return q.toLowerCase().indexOf('p') === -1 ? q + 'p' : q;
            }
        }
        return null;
    }

    // ========== GET QUALITIES FROM PLAYDATA ==========
    function getQualitiesFromPlaydata() {
        try {
            var pd = Lampa.Player.playdata();
            if (!pd) return null;

            // Check if playdata has quality object like {"1080p": url, "720p": url}
            if (pd.quality && typeof pd.quality === 'object' && !Array.isArray(pd.quality)) {
                var qualities = [];
                var keys = Object.keys(pd.quality);
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    var val = pd.quality[key];
                    if (typeof val === 'string' && val.indexOf('http') === 0) {
                        qualities.push({
                            url: val,
                            quality: key,
                            bandwidth: 0
                        });
                    }
                }
                if (qualities.length > 1) {
                    // Sort by quality (higher first)
                    qualities.sort(function(a, b) {
                        var aNum = parseInt(a.quality) || 0;
                        var bNum = parseInt(b.quality) || 0;
                        return bNum - aNum;
                    });
                    return qualities;
                }
            }

            // Check for playlist array
            if (pd.playlist && Array.isArray(pd.playlist) && pd.playlist.length > 1) {
                var qualities = [];
                for (var i = 0; i < pd.playlist.length; i++) {
                    var item = pd.playlist[i];
                    if (item && item.url) {
                        qualities.push({
                            url: item.url,
                            quality: item.quality || item.title || extractQualityFromUrl(item.url) || 'Quality ' + (i + 1),
                            bandwidth: 0
                        });
                    }
                }
                if (qualities.length > 1) return qualities;
            }
        } catch (e) {}
        return null;
    }

    // ========== DOWNLOAD ACTIONS ==========
    function doDownload(url, quality) {
        var filename = getFilename(quality);
        var dlUrl = url + '#filename=' + encodeURIComponent(filename + '.mp4');
        Lampa.Android.openPlayer(dlUrl, JSON.stringify({ title: filename }));
        Lampa.Noty.show('Downloading: ' + filename);
    }

    function doExternal(url, quality) {
        var filename = getFilename(quality);
        Lampa.Android.openPlayer(url, JSON.stringify({ title: filename }));
        Lampa.Noty.show('Opening player...');
    }

    // ========== GET FILE SIZE ==========
    function getFileSize(url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('HEAD', url, true);
        xhr.timeout = 5000;
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    var size = xhr.getResponseHeader('Content-Length');
                    callback(size ? parseInt(size, 10) : 0);
                } else {
                    callback(0);
                }
            }
        };
        xhr.onerror = function() { callback(0); };
        xhr.ontimeout = function() { callback(0); };
        xhr.send();
    }

    // ========== DOWNLOAD MENU ==========
    function showDownloadMenu(url, quality, returnTo, fileSize) {
        if (!url || url.indexOf('http') !== 0) {
            Lampa.Noty.show('Invalid URL');
            return;
        }

        returnTo = returnTo || 'player';
        var androidAvailable = Lampa.Android && Lampa.Android.openPlayer;
        var filename = getFilename(quality);
        var sizeText = fileSize ? ' (' + formatBytes(fileSize) + ')' : '';

        var items = [
            { title: '🔗 Show URL', subtitle: url.substring(0, 50) + '...', id: 'showurl' }
        ];

        if (androidAvailable) {
            items.push({ title: '📥 ADM / 1DM / DVGet', subtitle: filename + '.mp4' + sizeText, id: 'download' });
            items.push({ title: '▶️ External Player', subtitle: 'VLC, MX...', id: 'external' });
        }

        items.push({ title: '📋 Copy URL', id: 'copy' });

        Lampa.Select.show({
            title: 'Download: ' + quality + sizeText,
            items: items,
            onSelect: function(item) {
                Lampa.Select.close();
                if (item.id === 'download') {
                    doDownload(url, quality);
                } else if (item.id === 'external') {
                    doExternal(url, quality);
                } else if (item.id === 'copy') {
                    copyToClipboard(url);
                    Lampa.Noty.show('Copied!');
                } else if (item.id === 'showurl') {
                    copyToClipboard(url);
                    Lampa.Noty.show(url.substring(0, 100));
                }
                Lampa.Controller.toggle(returnTo);
            },
            onBack: function() { Lampa.Controller.toggle(returnTo); },
            _dlHelper: true
        });
    }

    // Show download menu with file size fetching
    function showDownloadMenuWithSize(url, quality, returnTo) {
        // For HLS streams, don't try to get size
        if (url.indexOf('.m3u8') > -1) {
            showDownloadMenu(url, quality, returnTo, 0);
            return;
        }
        // Try to get file size for direct URLs
        getFileSize(url, function(size) {
            showDownloadMenu(url, quality, returnTo, size);
        });
    }

    // ========== HLS PARSER ==========
    function parseHlsMaster(m3u8Text, baseUrl) {
        var streams = [];
        var lines = m3u8Text.split('\n');
        var currentInfo = null;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();

            // Parse stream info
            if (line.indexOf('#EXT-X-STREAM-INF:') === 0) {
                currentInfo = {};
                // Extract BANDWIDTH
                var bwMatch = line.match(/BANDWIDTH=(\d+)/);
                if (bwMatch) currentInfo.bandwidth = parseInt(bwMatch[1], 10);
                // Extract RESOLUTION
                var resMatch = line.match(/RESOLUTION=(\d+x\d+)/);
                if (resMatch) currentInfo.resolution = resMatch[1];
            }
            // URL line after stream info
            else if (currentInfo && line && !line.startsWith('#')) {
                var streamUrl = line;
                // Handle relative URLs
                if (streamUrl.indexOf('http') !== 0) {
                    var baseParts = baseUrl.split('/');
                    baseParts.pop();
                    streamUrl = baseParts.join('/') + '/' + streamUrl;
                }

                var quality = currentInfo.resolution || (currentInfo.bandwidth ? Math.round(currentInfo.bandwidth / 1000) + 'kbps' : 'Stream');
                streams.push({
                    url: streamUrl,
                    quality: quality,
                    bandwidth: currentInfo.bandwidth || 0
                });
                currentInfo = null;
            }
        }

        // Sort by bandwidth (highest first)
        streams.sort(function(a, b) { return b.bandwidth - a.bandwidth; });

        return streams;
    }

    function fetchHlsVariants(url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.timeout = 10000;
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200 && xhr.responseText) {
                    var text = xhr.responseText;
                    // Check if it's a master playlist (has STREAM-INF)
                    if (text.indexOf('#EXT-X-STREAM-INF') > -1) {
                        var streams = parseHlsMaster(text, url);
                        callback(streams);
                    } else {
                        // It's a media playlist, not master - just return original URL
                        callback([{ url: url, quality: 'Default', bandwidth: 0 }]);
                    }
                } else {
                    callback([{ url: url, quality: 'Default', bandwidth: 0 }]);
                }
            }
        };
        xhr.onerror = function() { callback([{ url: url, quality: 'Default', bandwidth: 0 }]); };
        xhr.ontimeout = function() { callback([{ url: url, quality: 'Default', bandwidth: 0 }]); };
        xhr.send();
    }

    // ========== QUALITY SELECTOR ==========
    function showQualitySelector(streams, returnTo) {
        if (!streams || streams.length === 0) {
            Lampa.Noty.show('No streams available');
            return;
        }

        if (streams.length === 1) {
            showDownloadMenuWithSize(streams[0].url, streams[0].quality || 'Video', returnTo);
            return;
        }

        var items = streams.map(function(s) {
            var subtitle = '';
            if (s.bandwidth) {
                subtitle = '~' + formatBytes(s.bandwidth / 8 * 3600) + '/hour';
            }
            return {
                title: s.quality || 'Video',
                subtitle: subtitle,
                url: s.url,
                quality: s.quality || 'Video'
            };
        });

        Lampa.Select.show({
            title: 'Select Quality (' + streams.length + ')',
            items: items,
            onSelect: function(item) {
                Lampa.Select.close();
                showDownloadMenuWithSize(item.url, item.quality, returnTo);
            },
            onBack: function() { Lampa.Controller.toggle(returnTo); },
            _dlHelper: true
        });
    }

    // ========== PLAYER MENU ==========
    function showPlayerMenu() {
        var url = getCurrentUrl();

        if (!url) {
            Lampa.Noty.show('No URL. Play video first!');
            return;
        }

        Lampa.Noty.show('Loading...');

        // Method 1: Try to get qualities from Lampa.Player.playdata()
        var pdQualities = getQualitiesFromPlaydata();
        if (pdQualities && pdQualities.length > 1) {
            showQualitySelector(pdQualities, 'player');
            return;
        }

        // Method 2: Check if it's an HLS stream and parse master playlist
        if (url.indexOf('.m3u8') > -1 || url.indexOf('m3u8') > -1) {
            fetchHlsVariants(url, function(streams) {
                if (streams.length > 1) {
                    showQualitySelector(streams, 'player');
                } else {
                    // Single stream - extract quality from URL or use default
                    var quality = extractQualityFromUrl(url) || 'Video';
                    showDownloadMenuWithSize(url, quality, 'player');
                }
            });
        } else {
            // Method 3: Direct URL - extract quality from URL pattern
            var quality = extractQualityFromUrl(url) || 'Video';
            showDownloadMenuWithSize(url, quality, 'player');
        }
    }

    // ========== PLAYER BUTTON ==========
    function addPlayerButton() {
        if (document.querySelector('.dlhelper-btn')) return;
        var panel = document.querySelector('.player-panel__right');
        if (!panel) return;

        var btn = document.createElement('div');
        btn.className = 'player-panel__item selector dlhelper-btn';
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:1.5em;height:1.5em;"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>';
        btn.addEventListener('click', showPlayerMenu);
        $(btn).on('hover:enter', showPlayerMenu);

        var settings = panel.querySelector('.player-panel__settings');
        if (settings) panel.insertBefore(btn, settings);
        else panel.appendChild(btn);
    }

    // ========== MAIN PLUGIN ==========
    function startPlugin() {
        window.lampa_download_helper = true;

        // Capture card
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') setTimeout(addPlayerButton, 500);
            try {
                var a = Lampa.Activity.active();
                if (a && a.card) savedCard = a.card;
            } catch(e) {}
        });

        // Player events
        if (Lampa.Player && Lampa.Player.listener) {
            Lampa.Player.listener.follow('start', function () {
                setTimeout(addPlayerButton, 500);
            });
        }

        // ========== INTERCEPT Select.show for "Действие" menu ==========
        var originalSelectShow = Lampa.Select.show;

        Lampa.Select.show = function(params) {
            if (params && params._dlHelper) {
                return originalSelectShow.call(this, params);
            }

            if (params && params.items && Array.isArray(params.items)) {
                var menuTitle = (params.title || '').toLowerCase();
                var isActionMenu = menuTitle.indexOf('действие') > -1 || menuTitle.indexOf('action') > -1;

                if (isActionMenu) {
                    params.items.push({
                        title: '⬇️ Download',
                        subtitle: 'Current stream',
                        onSelect: function() {
                            Lampa.Select.close();
                            showPlayerMenu();
                        }
                    });
                }
            }

            return originalSelectShow.call(this, params);
        };
    }

    // ========== INIT ==========
    if (!window.lampa_download_helper) {
        startPlugin();
    }
})();
