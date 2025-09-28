class TikTokDownloader {
    constructor() {
        this.apiUrl = 'https://delirius-apiofc.vercel.app/download/tiktok?url=';
        this.isProcessing = false;
        this.initializeEventListeners();
        this.initializeAccordion();
        this.updateYear();
    }

    initializeEventListeners() {
        const downloadBtn = document.getElementById('downloadBtn');
        const urlInput = document.getElementById('tiktokUrl');

        downloadBtn.addEventListener('click', () => this.handleDownload());
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleDownload();
            }
        });

        urlInput.addEventListener('input', () => {
            this.validateUrl(urlInput.value);
        });

        // Clear error when user starts typing
        urlInput.addEventListener('focus', () => {
            this.clearMessages();
        });

        // Use event delegation for download links (works for dynamically created elements)
        document.addEventListener('click', (e) => {
            if (e.target.closest('#downloadLink')) {
                e.preventDefault();
                const link = e.target.closest('#downloadLink');
                this.handleDownloadClick(link.href);
            }
        });
    }

    initializeAccordion() {
        const accordionHeaders = document.querySelectorAll('.accordion-header');
        
        accordionHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const item = header.parentElement;
                const isActive = item.classList.contains('active');
                
                // Close all items
                document.querySelectorAll('.accordion-item').forEach(el => {
                    el.classList.remove('active');
                });
                
                // Open current item if it wasn't active
                if (!isActive) {
                    item.classList.add('active');
                }
            });
        });

        // Open first accordion item by default
        if (accordionHeaders.length > 0) {
            accordionHeaders[0].parentElement.classList.add('active');
        }
    }

    updateYear() {
        const yearElement = document.getElementById('year');
        if (yearElement) {
            yearElement.textContent = new Date().getFullYear();
        }
    }

    validateUrl(url) {
        const errorMessage = document.getElementById('errorMessage');
        
        // More comprehensive TikTok URL regex pattern
        const tiktokRegex = /https?:\/\/(www\.|vm\.|vt\.|m\.)?tiktok\.com\/(.*\/video\/\d+|.*\?|t\/\w+\/|\w+\/|\S+)/;
        
        // Alternative pattern for short URLs
        const shortTiktokRegex = /https?:\/\/(vm|vt)\.tiktok\.com\/\w+/;
        
        // Pattern for tiktok.com/t/ format
        const tFormatRegex = /https?:\/\/www\.tiktok\.com\/t\/\w+/;

        if (!url) {
            errorMessage.textContent = '';
            return false;
        }

        // Test against all valid TikTok URL patterns
        const isValid = tiktokRegex.test(url) || shortTiktokRegex.test(url) || tFormatRegex.test(url);
        
        if (!isValid) {
            errorMessage.textContent = 'Please enter a valid TikTok URL. Examples:\n• https://www.tiktok.com/@username/video/123456789\n• https://vm.tiktok.com/ZMA56TGY8/\n• https://www.tiktok.com/t/abc123def';
            return false;
        } else {
            errorMessage.textContent = '';
            return true;
        }
    }

    clearMessages() {
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';
    }

    async handleDownload() {
        if (this.isProcessing) return;

        const urlInput = document.getElementById('tiktokUrl');
        const url = urlInput.value.trim();
        const errorMessage = document.getElementById('errorMessage');

        this.clearMessages();

        // Use a more lenient validation for the actual download
        if (!this.isValidTikTokUrl(url)) {
            if (!url) {
                errorMessage.textContent = 'Please enter a TikTok URL';
                errorMessage.style.display = 'block';
                urlInput.focus();
            } else {
                errorMessage.textContent = 'Please enter a valid TikTok URL. We support various formats including short links.';
                errorMessage.style.display = 'block';
            }
            return;
        }

        this.isProcessing = true;
        this.showLoading();

        try {
            const videoData = await this.fetchVideoData(url);
            await this.displayResult(videoData);
        } catch (error) {
            console.error('Download error:', error);
            this.handleError(error);
        } finally {
            this.hideLoading();
            this.isProcessing = false;
        }
    }

    // More lenient validation for actual processing
    isValidTikTokUrl(url) {
        if (!url) return false;
        
        // Basic check for TikTok domains
        const tiktokDomains = [
            'tiktok.com',
            'vm.tiktok.com',
            'vt.tiktok.com',
            'm.tiktok.com'
        ];
        
        try {
            const urlObj = new URL(url);
            return tiktokDomains.some(domain => urlObj.hostname.includes(domain));
        } catch (e) {
            return false;
        }
    }

    async fetchVideoData(url) {
        console.log('Fetching from API:', `${this.apiUrl}${encodeURIComponent(url)}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
            const response = await fetch(`${this.apiUrl}${encodeURIComponent(url)}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                mode: 'cors',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('API Response:', data);
            
            if (!data) {
                throw new Error('Empty response from server');
            }

            // Handle various API response structures
            let videoUrl = null;

            // Check for different response structures
            if (data.video) {
                videoUrl = data.video;
            } else if (data.data && data.data.play) {
                videoUrl = data.data.play;
            } else if (data.downloadUrl) {
                videoUrl = data.downloadUrl;
            } else if (data.url) {
                videoUrl = data.url;
            } else if (data.result && data.result.video) {
                videoUrl = data.result.video;
            } else if (data.play) {
                videoUrl = data.play;
            } else if (data.videoUrl) {
                videoUrl = data.videoUrl;
            }

            if (!videoUrl) {
                // Try to find any video URL in the response
                const jsonString = JSON.stringify(data).toLowerCase();
                const urlMatch = jsonString.match(/(https?:\/\/[^\s",]+\.(mp4|mov|avi|webm|m3u8))/);
                if (urlMatch) {
                    videoUrl = urlMatch[1];
                } else {
                    // If no direct video URL found, check for nested structures
                    videoUrl = this.findVideoUrlInObject(data);
                    if (!videoUrl) {
                        throw new Error('No video URL found in response');
                    }
                }
            }

            return {
                videoUrl: videoUrl,
                originalData: data
            };
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout. Please try again.');
            }
            throw error;
        }
    }

    // Recursive function to find video URL in nested objects
    findVideoUrlInObject(obj, depth = 0) {
        if (depth > 5) return null; // Prevent infinite recursion
        
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                
                // Check if value is a string that looks like a video URL
                if (typeof value === 'string' && value.match(/https?:\/\/[^\s]+\.(mp4|mov|avi|webm|m3u8)/)) {
                    return value;
                }
                
                // If value is an object or array, search recursively
                if (typeof value === 'object' && value !== null) {
                    const result = this.findVideoUrlInObject(value, depth + 1);
                    if (result) return result;
                }
            }
        }
        return null;
    }

    async displayResult(data) {
        const resultSection = document.getElementById('resultSection');
        const videoPreview = document.getElementById('videoPreview');

        if (!data.videoUrl) {
            throw new Error('No video URL provided');
        }

        // Create video preview
        videoPreview.innerHTML = `
            <div class="video-container">
                <video controls style="width: 100%; max-width: 400px; border-radius: 12px;">
                    <source src="${data.videoUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
                <div class="video-info">
                    <p><i class="fas fa-check-circle"></i> Video loaded successfully</p>
                </div>
            </div>
        `;

        // Add error handling for video preview
        const videoElement = videoPreview.querySelector('video');
        videoElement.addEventListener('error', () => {
            videoPreview.innerHTML = `
                <div class="video-error">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ff6b6b; margin-bottom: 1rem;"></i>
                    <p>Video cannot be previewed, but you can still download it.</p>
                </div>
            `;
        });

        // Set download link with proper filename
        const filename = `tiktok-video-${Date.now()}.mp4`;
        
        // Create download options HTML
        const downloadOptions = document.querySelector('.download-options');
        downloadOptions.innerHTML = `
            <a id="downloadLink" class="download-option-btn" href="${data.videoUrl}" download="${filename}" title="Download ${filename}">
                <i class="fas fa-download"></i> Download Video
            </a>
            <button id="downloadAnother" class="download-another-btn">
                <i class="fas fa-redo"></i> Download Another Video
            </button>
        `;

        // Add event listener for "Download Another" button
        document.getElementById('downloadAnother').addEventListener('click', () => {
            this.resetForm();
        });

        // Show result section
        resultSection.classList.remove('hidden');
        
        // Scroll to result section
        setTimeout(() => {
            resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }

    handleDownloadClick(url) {
        console.log('Download initiated:', url);
        this.showSuccess('Download started!');
        
        // Create a temporary anchor to force download
        const tempLink = document.createElement('a');
        tempLink.href = url;
        tempLink.download = `tiktok-video-${Date.now()}.mp4`;
        tempLink.style.display = 'none';
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
    }

    resetForm() {
        const urlInput = document.getElementById('tiktokUrl');
        const resultSection = document.getElementById('resultSection');
        const downloadOptions = document.querySelector('.download-options');
        
        // Clear the input
        urlInput.value = '';
        
        // Hide result section
        resultSection.classList.add('hidden');
        
        // Clear download options
        downloadOptions.innerHTML = '';
        
        // Focus back on the input
        urlInput.focus();
        
        this.clearMessages();
    }

    showSuccess(message) {
        // Create a temporary success message
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        successDiv.style.cssText = `
            background: #4CAF50;
            color: white;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
            text-align: center;
        `;
        
        const downloadForm = document.querySelector('.download-form');
        downloadForm.appendChild(successDiv);
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    handleError(error) {
        const errorMessage = document.getElementById('errorMessage');
        
        let message = 'An unexpected error occurred. Please try again.';
        
        if (error.message.includes('404')) {
            message = 'Video not found. Please check the URL and try again.';
        } else if (error.message.includes('500')) {
            message = 'Server error. Please try again in a few minutes.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
            message = 'Network error. Please check your internet connection.';
        } else if (error.message.includes('CORS')) {
            message = 'Browser security restriction. Please try refreshing the page.';
        } else if (error.message.includes('No video URL')) {
            message = 'Video might be private, removed, or unavailable for download.';
        } else if (error.message.includes('timeout')) {
            message = 'Request timeout. The server is taking too long to respond.';
        } else if (error.message.includes('Invalid URL')) {
            message = 'Please enter a valid TikTok URL.';
        } else if (error.message.includes('private') || error.message.includes('unavailable')) {
            message = 'This video might be private or unavailable. Try a different video.';
        }
        
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        
        // Scroll to error message
        setTimeout(() => {
            errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }

    showLoading() {
        const loadingSpinner = document.getElementById('loadingSpinner');
        const downloadBtn = document.getElementById('downloadBtn');
        
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        loadingSpinner.classList.remove('hidden');
    }

    hideLoading() {
        const loadingSpinner = document.getElementById('loadingSpinner');
        const downloadBtn = document.getElementById('downloadBtn');
        
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download';
        loadingSpinner.classList.add('hidden');
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    try {
        const downloader = new TikTokDownloader();
        console.log('TikTok Downloader initialized successfully');
        
        // Add smooth scrolling for navigation links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;
                
                const target = document.querySelector(targetId);
                if (target) {
                    const headerHeight = document.querySelector('.header').offsetHeight;
                    const targetPosition = target.offsetTop - headerHeight - 20;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });

    } catch (error) {
        console.error('Failed to initialize TikTok Downloader:', error);
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.textContent = 'Failed to initialize application. Please refresh the page.';
            errorMessage.style.display = 'block';
        }
    }
});