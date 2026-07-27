"""
Flask Backend API for IMDb Movie Scraper
Provides REST endpoints for scraping and retrieving movie data
"""

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from scraper import IMDbScraper, scrape_imdb_top250
import pandas as pd
import os
from datetime import datetime
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Configuration
DATA_FILE = "data/imdb_top250.csv"
CACHE_FILE = "data/cache.json"

class MovieDataManager:
    """Manage movie data with caching"""
    
    def __init__(self):
        self.cache = {}
        self.load_cache()
    
    def load_cache(self):
        """Load cached data"""
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r') as f:
                    self.cache = json.load(f)
            except:
                self.cache = {}
    
    def save_cache(self):
        """Save data to cache"""
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        with open(CACHE_FILE, 'w') as f:
            json.dump(self.cache, f)
    
    def get_movies(self, force_refresh=False):
        """Get movies from cache or scrape"""
        # Check if we have cached data and it's recent (within 24 hours)
        if not force_refresh and 'movies' in self.cache:
            last_scrape = datetime.fromisoformat(self.cache.get('last_scrape', '2000-01-01'))
            time_diff = (datetime.now() - last_scrape).total_seconds()
            
            if time_diff < 86400:  # 24 hours
                print("Returning cached data")
                return self.cache['movies']
        
        # Scrape new data
        print("Scraping fresh data...")
        scraper = IMDbScraper(headless=True)
        movies = scraper.scrape_top250()
        
        if movies:
            self.cache['movies'] = movies
            self.cache['last_scrape'] = datetime.now().isoformat()
            self.cache['total_movies'] = len(movies)
            self.save_cache()
            scraper.save_to_csv()
        
        return movies

# Initialize data manager
data_manager = MovieDataManager()

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'IMDb Movie Scraper API'
    })

@app.route('/api/movies', methods=['GET'])
def get_movies():
    """Get all movies with optional filtering"""
    try:
        force_refresh = request.args.get('refresh', 'false').lower() == 'true'
        movies = data_manager.get_movies(force_refresh=force_refresh)
        
        # Apply filters
        search = request.args.get('search', '')
        min_rating = request.args.get('min_rating', '')
        max_rating = request.args.get('max_rating', '')
        year = request.args.get('year', '')
        
        filtered_movies = movies
        if search:
            filtered_movies = [m for m in filtered_movies if search.lower() in m['title'].lower()]
        if min_rating:
            try:
                min_r = float(min_rating)
                filtered_movies = [m for m in filtered_movies if float(m['rating']) >= min_r]
            except:
                pass
        if max_rating:
            try:
                max_r = float(max_rating)
                filtered_movies = [m for m in filtered_movies if float(m['rating']) <= max_r]
            except:
                pass
        if year:
            filtered_movies = [m for m in filtered_movies if year in str(m['year'])]
        
        return jsonify({
            'success': True,
            'total': len(movies),
            'filtered_total': len(filtered_movies),
            'data': filtered_movies,
            'last_updated': data_manager.cache.get('last_scrape', 'N/A')
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/movies/export', methods=['GET'])
def export_movies():
    """Export movies as CSV"""
    try:
        if not os.path.exists(DATA_FILE):
            return jsonify({
                'success': False,
                'error': 'No data available. Please scrape first.'
            }), 404
        
        return send_file(
            DATA_FILE,
            as_attachment=True,
            download_name=f'imdb_top250_{datetime.now().strftime("%Y%m%d")}.csv',
            mimetype='text/csv'
        )
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    """Get movie statistics"""
    try:
        movies = data_manager.get_movies()
        
        if not movies:
            return jsonify({
                'success': False,
                'error': 'No data available'
            }), 404
        
        # Calculate statistics
        ratings = [float(m['rating']) for m in movies if m['rating'] != 'N/A']
        years = [int(m['year']) if m['year'] != 'N/A' else None for m in movies]
        years = [y for y in years if y is not None]
        
        stats = {
            'total_movies': len(movies),
            'average_rating': sum(ratings) / len(ratings) if ratings else 0,
            'min_rating': min(ratings) if ratings else 0,
            'max_rating': max(ratings) if ratings else 0,
            'oldest_year': min(years) if years else 0,
            'newest_year': max(years) if years else 0,
            'decade_distribution': get_decade_distribution(years),
            'rating_distribution': get_rating_distribution(ratings)
        }
        
        return jsonify({
            'success': True,
            'data': stats
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def get_decade_distribution(years):
    """Get distribution of movies by decade"""
    distribution = {}
    for year in years:
        decade = (year // 10) * 10
        decade_key = f"{decade}s"
        distribution[decade_key] = distribution.get(decade_key, 0) + 1
    return dict(sorted(distribution.items()))

def get_rating_distribution(ratings):
    """Get distribution of ratings"""
    distribution = {}
    for rating in ratings:
        rating_floor = int(rating)
        key = f"{rating_floor}.0-{rating_floor+1}.0"
        distribution[key] = distribution.get(key, 0) + 1
    return dict(sorted(distribution.items()))

@app.route('/api/search', methods=['GET'])
def search_movies():
    """Search movies by title"""
    try:
        query = request.args.get('q', '').strip()
        if not query:
            return jsonify({
                'success': False,
                'error': 'Search query required'
            }), 400
        
        movies = data_manager.get_movies()
        results = [m for m in movies if query.lower() in m['title'].lower()]
        
        return jsonify({
            'success': True,
            'query': query,
            'total': len(results),
            'data': results
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)