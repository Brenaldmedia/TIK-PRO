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
        const downloadLink = document.getElementById('downloadLink');

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

        // Add event listener for the download link in result section
        if (downloadLink) {
            downloadLink.addEventListener('click', (e) => {
                this.trackDownload(downloadLink.href);
            });
        }
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
        const tiktokRegex = /https?:\/\/(www\.|vm\.|vt\.)?tiktok\.com\/(.*\/video\/\d+|.*\?|t\/\w+\/)/;

        if (!url) {
            errorMessage.textContent = '';
            return false;
        }

        if (!tiktokRegex.test(url)) {
            errorMessage.textContent = 'Please enter a valid TikTok URL (e.g., https://www.tiktok.com/@username/video/123456789)';
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

        if (!this.validateUrl(url)) {
            if (!url) {
                errorMessage.textContent = 'Please enter a TikTok URL';
                errorMessage.style.display = 'block';
                urlInput.focus();
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
            }

            if (!videoUrl) {
                // Try to find any video URL in the response
                const jsonString = JSON.stringify(data).toLowerCase();
                const urlMatch = jsonString.match(/(https?:\/\/[^\s",]+\.(mp4|mov|avi|webm))/);
                if (urlMatch) {
                    videoUrl = urlMatch[1];
                } else {
                    throw new Error('No video URL found in response');
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

    async displayResult(data) {
        const resultSection = document.getElementById('resultSection');
        const videoPreview = document.getElementById('videoPreview');
        const downloadLink = document.getElementById('downloadLink');

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
        downloadLink.href = data.videoUrl;
        downloadLink.setAttribute('download', filename);
        downloadLink.setAttribute('title', `Download ${filename}`);

        // Update the download link event listener
        downloadLink.replaceWith(downloadLink.cloneNode(true));
        const newDownloadLink = document.getElementById('downloadLink');
        newDownloadLink.addEventListener('click', () => {
            this.trackDownload(data.videoUrl);
        });

        // Show result section
        resultSection.classList.remove('hidden');
        
        // Scroll to result section
        setTimeout(() => {
            resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }

    trackDownload(url) {
        console.log('Download initiated:', url);
        // You can add analytics tracking here
        this.showSuccess('Download started!');
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