import re
import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template

app = Flask(__name__)

NAMESPACE = {'atom': 'http://www.w3.org/2005/Atom'}

def parse_html_content(html_content):
    """
    Parses HTML content from release notes feed.
    Splits content by <h3> headers to isolate individual updates.
    """
    if not html_content:
        return []
    
    # Find all <h3>Category</h3> followed by the HTML content up to the next <h3> or end of string
    pattern = r'<h3>(.*?)</h3>(.*?)(?=<h3>|$)'
    matches = re.findall(pattern, html_content, re.DOTALL)
    
    items = []
    for idx, (type_name, content) in enumerate(matches):
        type_name = type_name.strip()
        content = content.strip()
        items.append({
            'id': idx,
            'type': type_name,
            'content': content
        })
        
    if not items:
        # Fallback if no <h3> tags are found
        items.append({
            'id': 0,
            'type': 'Update',
            'content': html_content.strip()
        })
        
    return items

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        
        feed_title = root.find('atom:title', NAMESPACE)
        feed_title = feed_title.text if feed_title is not None else "BigQuery Release Notes"
        
        feed_updated = root.find('atom:updated', NAMESPACE)
        feed_updated = feed_updated.text if feed_updated is not None else ""
        
        entries = []
        
        for entry in root.findall('atom:entry', NAMESPACE):
            title_el = entry.find('atom:title', NAMESPACE)
            id_el = entry.find('atom:id', NAMESPACE)
            updated_el = entry.find('atom:updated', NAMESPACE)
            link_el = entry.find('atom:link[@rel="alternate"]', NAMESPACE)
            if link_el is None:
                link_el = entry.find('atom:link', NAMESPACE)
            content_el = entry.find('atom:content', NAMESPACE)
            
            title = title_el.text if title_el is not None else ""
            entry_id = id_el.text if id_el is not None else ""
            updated = updated_el.text if updated_el is not None else ""
            link = link_el.attrib.get('href', '') if link_el is not None else ""
            html_content = content_el.text if content_el is not None else ""
            
            parsed_items = parse_html_content(html_content)
            
            entries.append({
                'date': title,
                'id': entry_id,
                'updated': updated,
                'url': link,
                'items': parsed_items
            })
            
        return jsonify({
            'status': 'success',
            'title': feed_title,
            'updated': feed_updated,
            'entries': entries
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
