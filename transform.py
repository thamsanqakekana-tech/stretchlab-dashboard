"""
StretchLab B2C Pipeline - Transform Module (V4.0 FINAL CORRECTED)
CORRECT LOGIC: Direct + Tamryn only (NO phone matching)
FIXED: Proper show matching with first_visits sheet
"""

import re as _re
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def _norm_name(s):
    """Normalise a name for fuzzy matching: lowercase, strip punctuation, collapse spaces."""
    if pd.isna(s): return None
    return _re.sub(r'\s+', ' ', _re.sub(r'[^\w\s]', '', str(s)).lower()).strip()

# Known name corrections: manual tracker misspellings → canonical ClubReady spelling (normalised)
_NAME_CORRECTIONS = {
    'edgar monray': 'edgar monroy',
}

# Area code to region mapping
AREA_CODE_MAP = {
    # Louisiana
    '318': {'state': 'Louisiana', 'city': 'Shreveport',   'region': 'Louisiana'},
    '337': {'state': 'Louisiana', 'city': 'Lafayette',    'region': 'Louisiana'},
    '504': {'state': 'Louisiana', 'city': 'New Orleans',  'region': 'Louisiana'},
    '985': {'state': 'Louisiana', 'city': 'Slidell',      'region': 'Louisiana'},
    '225': {'state': 'Louisiana', 'city': 'Baton Rouge',  'region': 'Louisiana'},
    # Texas — Houston metro
    '281': {'state': 'Texas', 'city': 'Houston',  'region': 'Texas-Houston'},
    '346': {'state': 'Texas', 'city': 'Houston',  'region': 'Texas-Houston'},
    '713': {'state': 'Texas', 'city': 'Houston',  'region': 'Texas-Houston'},
    '832': {'state': 'Texas', 'city': 'Houston',  'region': 'Texas-Houston'},
    '469': {'state': 'Texas', 'city': 'Dallas',   'region': 'Texas-Houston'},
    '972': {'state': 'Texas', 'city': 'Dallas',   'region': 'Texas-Houston'},
    # Texas — other
    '210': {'state': 'Texas', 'city': 'San Antonio',           'region': 'Texas-Other'},
    '214': {'state': 'Texas', 'city': 'Dallas',                'region': 'Texas-Other'},
    '512': {'state': 'Texas', 'city': 'Austin',                'region': 'Texas-Other'},
    '817': {'state': 'Texas', 'city': 'Fort Worth',            'region': 'Texas-Other'},
    '979': {'state': 'Texas', 'city': 'Bryan-College Station', 'region': 'Texas-Other'},
    '409': {'state': 'Texas', 'city': 'Beaumont',              'region': 'Texas-Other'},
    '903': {'state': 'Texas', 'city': 'Tyler',                 'region': 'Texas-Other'},
    '936': {'state': 'Texas', 'city': 'Conroe',                'region': 'Texas-Other'},
    '254': {'state': 'Texas', 'city': 'Waco',                  'region': 'Texas-Other'},
    '956': {'state': 'Texas', 'city': 'Laredo',                'region': 'Texas-Other'},
    '432': {'state': 'Texas', 'city': 'Midland',               'region': 'Texas-Other'},
    '682': {'state': 'Texas', 'city': 'Fort Worth',            'region': 'Texas-Other'},
    '940': {'state': 'Texas', 'city': 'Wichita Falls',         'region': 'Texas-Other'},
    '830': {'state': 'Texas', 'city': 'San Antonio',           'region': 'Texas-Other'},
    '361': {'state': 'Texas', 'city': 'Corpus Christi',        'region': 'Texas-Other'},
    '325': {'state': 'Texas', 'city': 'Abilene',               'region': 'Texas-Other'},
    '806': {'state': 'Texas', 'city': 'Lubbock',               'region': 'Texas-Other'},
    '915': {'state': 'Texas', 'city': 'El Paso',               'region': 'Texas-Other'},
    '726': {'state': 'Texas', 'city': 'San Antonio',           'region': 'Texas-Other'},
    '737': {'state': 'Texas', 'city': 'Austin',                'region': 'Texas-Other'},
    '430': {'state': 'Texas', 'city': 'Tyler',                 'region': 'Texas-Other'},
    # Michigan
    '248': {'state': 'Michigan', 'city': 'Troy',           'region': 'Michigan'},
    '313': {'state': 'Michigan', 'city': 'Detroit',        'region': 'Michigan'},
    '586': {'state': 'Michigan', 'city': 'Warren',         'region': 'Michigan'},
    '734': {'state': 'Michigan', 'city': 'Ann Arbor',      'region': 'Michigan'},
    '810': {'state': 'Michigan', 'city': 'Flint',          'region': 'Michigan'},
    '517': {'state': 'Michigan', 'city': 'Lansing',        'region': 'Michigan'},
    '989': {'state': 'Michigan', 'city': 'Saginaw',        'region': 'Michigan'},
    '616': {'state': 'Michigan', 'city': 'Grand Rapids',   'region': 'Michigan'},
    '269': {'state': 'Michigan', 'city': 'Kalamazoo',      'region': 'Michigan'},
    '231': {'state': 'Michigan', 'city': 'Traverse City',  'region': 'Michigan'},
    '906': {'state': 'Michigan', 'city': 'Marquette',      'region': 'Michigan'},
    # Oklahoma
    '918': {'state': 'Oklahoma', 'city': 'Tulsa',         'region': 'Oklahoma'},
    '405': {'state': 'Oklahoma', 'city': 'Oklahoma City', 'region': 'Oklahoma'},
    '539': {'state': 'Oklahoma', 'city': 'Tulsa',         'region': 'Oklahoma'},
    '580': {'state': 'Oklahoma', 'city': 'Lawton',        'region': 'Oklahoma'},
    # Missouri
    '314': {'state': 'Missouri', 'city': 'St. Louis',   'region': 'Missouri'},
    '816': {'state': 'Missouri', 'city': 'Kansas City', 'region': 'Missouri'},
    '417': {'state': 'Missouri', 'city': 'Springfield', 'region': 'Missouri'},
    '573': {'state': 'Missouri', 'city': 'Columbia',    'region': 'Missouri'},
    '660': {'state': 'Missouri', 'city': 'Sedalia',     'region': 'Missouri'},
    # Arkansas
    '501': {'state': 'Arkansas', 'city': 'Little Rock',  'region': 'Arkansas'},
    '870': {'state': 'Arkansas', 'city': 'Jonesboro',    'region': 'Arkansas'},
    '479': {'state': 'Arkansas', 'city': 'Fayetteville', 'region': 'Arkansas'},
    # Georgia
    '678': {'state': 'Georgia', 'city': 'Atlanta',   'region': 'Georgia'},
    '404': {'state': 'Georgia', 'city': 'Atlanta',   'region': 'Georgia'},
    '706': {'state': 'Georgia', 'city': 'Augusta',   'region': 'Georgia'},
    '470': {'state': 'Georgia', 'city': 'Atlanta',   'region': 'Georgia'},
    '912': {'state': 'Georgia', 'city': 'Savannah',  'region': 'Georgia'},
    '478': {'state': 'Georgia', 'city': 'Macon',     'region': 'Georgia'},
    '770': {'state': 'Georgia', 'city': 'Atlanta',   'region': 'Georgia'},
    # New York
    '917': {'state': 'New York', 'city': 'New York City',   'region': 'New York'},
    '347': {'state': 'New York', 'city': 'New York City',   'region': 'New York'},
    '646': {'state': 'New York', 'city': 'New York City',   'region': 'New York'},
    '718': {'state': 'New York', 'city': 'New York City',   'region': 'New York'},
    '929': {'state': 'New York', 'city': 'New York City',   'region': 'New York'},
    '332': {'state': 'New York', 'city': 'New York City',   'region': 'New York'},
    '516': {'state': 'New York', 'city': 'Long Island',     'region': 'New York'},
    '315': {'state': 'New York', 'city': 'Syracuse',        'region': 'New York'},
    '716': {'state': 'New York', 'city': 'Buffalo',         'region': 'New York'},
    '585': {'state': 'New York', 'city': 'Rochester',       'region': 'New York'},
    '914': {'state': 'New York', 'city': 'Yonkers',         'region': 'New York'},
    '845': {'state': 'New York', 'city': 'Poughkeepsie',    'region': 'New York'},
    # California
    '562': {'state': 'California', 'city': 'Long Beach',     'region': 'California'},
    '323': {'state': 'California', 'city': 'Los Angeles',    'region': 'California'},
    '310': {'state': 'California', 'city': 'Los Angeles',    'region': 'California'},
    '510': {'state': 'California', 'city': 'Oakland',        'region': 'California'},
    '949': {'state': 'California', 'city': 'Irvine',         'region': 'California'},
    '916': {'state': 'California', 'city': 'Sacramento',     'region': 'California'},
    '858': {'state': 'California', 'city': 'San Diego',      'region': 'California'},
    '619': {'state': 'California', 'city': 'San Diego',      'region': 'California'},
    '909': {'state': 'California', 'city': 'San Bernardino', 'region': 'California'},
    '818': {'state': 'California', 'city': 'Los Angeles',    'region': 'California'},
    '408': {'state': 'California', 'city': 'San Jose',       'region': 'California'},
    '530': {'state': 'California', 'city': 'Chico',          'region': 'California'},
    '925': {'state': 'California', 'city': 'Concord',        'region': 'California'},
    '760': {'state': 'California', 'city': 'Palm Springs',   'region': 'California'},
    '951': {'state': 'California', 'city': 'Riverside',      'region': 'California'},
    '714': {'state': 'California', 'city': 'Anaheim',        'region': 'California'},
    '213': {'state': 'California', 'city': 'Los Angeles',    'region': 'California'},
    '415': {'state': 'California', 'city': 'San Francisco',  'region': 'California'},
    '707': {'state': 'California', 'city': 'Santa Rosa',     'region': 'California'},
    '559': {'state': 'California', 'city': 'Fresno',         'region': 'California'},
    '650': {'state': 'California', 'city': 'San Mateo',      'region': 'California'},
    '747': {'state': 'California', 'city': 'Los Angeles',    'region': 'California'},
    '657': {'state': 'California', 'city': 'Anaheim',        'region': 'California'},
    '424': {'state': 'California', 'city': 'Los Angeles',    'region': 'California'},
    '661': {'state': 'California', 'city': 'Bakersfield',    'region': 'California'},
    # Illinois
    '312': {'state': 'Illinois', 'city': 'Chicago',       'region': 'Illinois'},
    '773': {'state': 'Illinois', 'city': 'Chicago',       'region': 'Illinois'},
    '708': {'state': 'Illinois', 'city': 'Chicago',       'region': 'Illinois'},
    '630': {'state': 'Illinois', 'city': 'Chicago',       'region': 'Illinois'},
    '815': {'state': 'Illinois', 'city': 'Rockford',      'region': 'Illinois'},
    '847': {'state': 'Illinois', 'city': 'Chicago',       'region': 'Illinois'},
    '217': {'state': 'Illinois', 'city': 'Springfield',   'region': 'Illinois'},
    '618': {'state': 'Illinois', 'city': 'East St. Louis','region': 'Illinois'},
    '309': {'state': 'Illinois', 'city': 'Peoria',        'region': 'Illinois'},
    '872': {'state': 'Illinois', 'city': 'Chicago',       'region': 'Illinois'},
    '524': {'state': 'Illinois', 'city': 'Chicago',       'region': 'Illinois'},
    # Florida
    '904': {'state': 'Florida', 'city': 'Jacksonville',    'region': 'Florida'},
    '239': {'state': 'Florida', 'city': 'Naples',          'region': 'Florida'},
    '850': {'state': 'Florida', 'city': 'Tallahassee',     'region': 'Florida'},
    '321': {'state': 'Florida', 'city': 'Orlando',         'region': 'Florida'},
    '407': {'state': 'Florida', 'city': 'Orlando',         'region': 'Florida'},
    '561': {'state': 'Florida', 'city': 'West Palm Beach', 'region': 'Florida'},
    '786': {'state': 'Florida', 'city': 'Miami',           'region': 'Florida'},
    '305': {'state': 'Florida', 'city': 'Miami',           'region': 'Florida'},
    '941': {'state': 'Florida', 'city': 'Sarasota',        'region': 'Florida'},
    '772': {'state': 'Florida', 'city': 'Stuart',          'region': 'Florida'},
    '813': {'state': 'Florida', 'city': 'Tampa',           'region': 'Florida'},
    '727': {'state': 'Florida', 'city': 'St. Petersburg',  'region': 'Florida'},
    '386': {'state': 'Florida', 'city': 'Daytona Beach',   'region': 'Florida'},
    '954': {'state': 'Florida', 'city': 'Fort Lauderdale', 'region': 'Florida'},
    '754': {'state': 'Florida', 'city': 'Fort Lauderdale', 'region': 'Florida'},
    # New Jersey
    '201': {'state': 'New Jersey', 'city': 'Jersey City',    'region': 'New Jersey'},
    '609': {'state': 'New Jersey', 'city': 'Trenton',        'region': 'New Jersey'},
    '856': {'state': 'New Jersey', 'city': 'Camden',         'region': 'New Jersey'},
    '732': {'state': 'New Jersey', 'city': 'New Brunswick',  'region': 'New Jersey'},
    '551': {'state': 'New Jersey', 'city': 'Jersey City',    'region': 'New Jersey'},
    '862': {'state': 'New Jersey', 'city': 'Newark',         'region': 'New Jersey'},
    '908': {'state': 'New Jersey', 'city': 'Elizabeth',      'region': 'New Jersey'},
    '973': {'state': 'New Jersey', 'city': 'Newark',         'region': 'New Jersey'},
    # Tennessee
    '615': {'state': 'Tennessee', 'city': 'Nashville',    'region': 'Tennessee'},
    '901': {'state': 'Tennessee', 'city': 'Memphis',      'region': 'Tennessee'},
    '423': {'state': 'Tennessee', 'city': 'Chattanooga',  'region': 'Tennessee'},
    '865': {'state': 'Tennessee', 'city': 'Knoxville',    'region': 'Tennessee'},
    '731': {'state': 'Tennessee', 'city': 'Jackson',      'region': 'Tennessee'},
    '931': {'state': 'Tennessee', 'city': 'Clarksville',  'region': 'Tennessee'},
    # Indiana
    '317': {'state': 'Indiana', 'city': 'Indianapolis', 'region': 'Indiana'},
    '574': {'state': 'Indiana', 'city': 'South Bend',   'region': 'Indiana'},
    '219': {'state': 'Indiana', 'city': 'Gary',         'region': 'Indiana'},
    '765': {'state': 'Indiana', 'city': 'Muncie',       'region': 'Indiana'},
    '260': {'state': 'Indiana', 'city': 'Fort Wayne',   'region': 'Indiana'},
    # Ohio
    '419': {'state': 'Ohio', 'city': 'Toledo',      'region': 'Ohio'},
    '740': {'state': 'Ohio', 'city': 'Newark',      'region': 'Ohio'},
    '937': {'state': 'Ohio', 'city': 'Dayton',      'region': 'Ohio'},
    '513': {'state': 'Ohio', 'city': 'Cincinnati',  'region': 'Ohio'},
    '614': {'state': 'Ohio', 'city': 'Columbus',    'region': 'Ohio'},
    '216': {'state': 'Ohio', 'city': 'Cleveland',   'region': 'Ohio'},
    '440': {'state': 'Ohio', 'city': 'Cleveland',   'region': 'Ohio'},
    # Pennsylvania
    '484': {'state': 'Pennsylvania', 'city': 'Allentown',    'region': 'Pennsylvania'},
    '215': {'state': 'Pennsylvania', 'city': 'Philadelphia', 'region': 'Pennsylvania'},
    '570': {'state': 'Pennsylvania', 'city': 'Scranton',     'region': 'Pennsylvania'},
    '814': {'state': 'Pennsylvania', 'city': 'Erie',         'region': 'Pennsylvania'},
    '412': {'state': 'Pennsylvania', 'city': 'Pittsburgh',   'region': 'Pennsylvania'},
    '267': {'state': 'Pennsylvania', 'city': 'Philadelphia', 'region': 'Pennsylvania'},
    '223': {'state': 'Pennsylvania', 'city': 'Lancaster',    'region': 'Pennsylvania'},
    '717': {'state': 'Pennsylvania', 'city': 'Harrisburg',   'region': 'Pennsylvania'},
    '724': {'state': 'Pennsylvania', 'city': 'Pittsburgh',   'region': 'Pennsylvania'},
    # Alabama
    '205': {'state': 'Alabama', 'city': 'Birmingham', 'region': 'Alabama'},
    '256': {'state': 'Alabama', 'city': 'Huntsville', 'region': 'Alabama'},
    '334': {'state': 'Alabama', 'city': 'Montgomery', 'region': 'Alabama'},
    '251': {'state': 'Alabama', 'city': 'Mobile',     'region': 'Alabama'},
    # Colorado
    '303': {'state': 'Colorado', 'city': 'Denver',           'region': 'Colorado'},
    '720': {'state': 'Colorado', 'city': 'Denver',           'region': 'Colorado'},
    '719': {'state': 'Colorado', 'city': 'Colorado Springs', 'region': 'Colorado'},
    '970': {'state': 'Colorado', 'city': 'Fort Collins',     'region': 'Colorado'},
    # Mississippi
    '601': {'state': 'Mississippi', 'city': 'Jackson', 'region': 'Mississippi'},
    '662': {'state': 'Mississippi', 'city': 'Tupelo',  'region': 'Mississippi'},
    '228': {'state': 'Mississippi', 'city': 'Biloxi',  'region': 'Mississippi'},
    # North Carolina
    '919': {'state': 'North Carolina', 'city': 'Raleigh',      'region': 'North Carolina'},
    '336': {'state': 'North Carolina', 'city': 'Greensboro',   'region': 'North Carolina'},
    '828': {'state': 'North Carolina', 'city': 'Asheville',    'region': 'North Carolina'},
    '910': {'state': 'North Carolina', 'city': 'Fayetteville', 'region': 'North Carolina'},
    '704': {'state': 'North Carolina', 'city': 'Charlotte',    'region': 'North Carolina'},
    '980': {'state': 'North Carolina', 'city': 'Charlotte',    'region': 'North Carolina'},
    '984': {'state': 'North Carolina', 'city': 'Raleigh',      'region': 'North Carolina'},
    '252': {'state': 'North Carolina', 'city': 'Rocky Mount',  'region': 'North Carolina'},
    # South Carolina
    '843': {'state': 'South Carolina', 'city': 'Charleston', 'region': 'South Carolina'},
    '803': {'state': 'South Carolina', 'city': 'Columbia',   'region': 'South Carolina'},
    '864': {'state': 'South Carolina', 'city': 'Greenville', 'region': 'South Carolina'},
    # Maryland
    '443': {'state': 'Maryland', 'city': 'Baltimore',    'region': 'Maryland'},
    '410': {'state': 'Maryland', 'city': 'Baltimore',    'region': 'Maryland'},
    '240': {'state': 'Maryland', 'city': 'Silver Spring','region': 'Maryland'},
    # Virginia
    '703': {'state': 'Virginia', 'city': 'Arlington',       'region': 'Virginia'},
    '571': {'state': 'Virginia', 'city': 'Arlington',       'region': 'Virginia'},
    '540': {'state': 'Virginia', 'city': 'Roanoke',         'region': 'Virginia'},
    '804': {'state': 'Virginia', 'city': 'Richmond',        'region': 'Virginia'},
    '757': {'state': 'Virginia', 'city': 'Virginia Beach',  'region': 'Virginia'},
    '434': {'state': 'Virginia', 'city': 'Charlottesville', 'region': 'Virginia'},
    # Kentucky
    '502': {'state': 'Kentucky', 'city': 'Louisville',    'region': 'Kentucky'},
    '859': {'state': 'Kentucky', 'city': 'Lexington',     'region': 'Kentucky'},
    '270': {'state': 'Kentucky', 'city': 'Bowling Green', 'region': 'Kentucky'},
    # Nevada
    '702': {'state': 'Nevada', 'city': 'Las Vegas', 'region': 'Nevada'},
    '775': {'state': 'Nevada', 'city': 'Reno',      'region': 'Nevada'},
    # Iowa
    '319': {'state': 'Iowa', 'city': 'Cedar Rapids', 'region': 'Iowa'},
    '641': {'state': 'Iowa', 'city': 'Mason City',   'region': 'Iowa'},
    '515': {'state': 'Iowa', 'city': 'Des Moines',   'region': 'Iowa'},
    # Kansas
    '316': {'state': 'Kansas', 'city': 'Wichita', 'region': 'Kansas'},
    '620': {'state': 'Kansas', 'city': 'Wichita', 'region': 'Kansas'},
    # Connecticut
    '203': {'state': 'Connecticut', 'city': 'Bridgeport', 'region': 'Connecticut'},
    '860': {'state': 'Connecticut', 'city': 'Hartford',   'region': 'Connecticut'},
    '475': {'state': 'Connecticut', 'city': 'Bridgeport', 'region': 'Connecticut'},
    # Wisconsin
    '414': {'state': 'Wisconsin', 'city': 'Milwaukee', 'region': 'Wisconsin'},
    '608': {'state': 'Wisconsin', 'city': 'Madison',   'region': 'Wisconsin'},
    '262': {'state': 'Wisconsin', 'city': 'Racine',    'region': 'Wisconsin'},
    # Nebraska
    '402': {'state': 'Nebraska', 'city': 'Omaha', 'region': 'Nebraska'},
    # Washington State
    '509': {'state': 'Washington', 'city': 'Spokane',    'region': 'Washington'},
    '360': {'state': 'Washington', 'city': 'Bellingham', 'region': 'Washington'},
    '253': {'state': 'Washington', 'city': 'Tacoma',     'region': 'Washington'},
    # Oregon
    '503': {'state': 'Oregon', 'city': 'Portland', 'region': 'Oregon'},
    # Arizona
    '602': {'state': 'Arizona', 'city': 'Phoenix',    'region': 'Arizona'},
    '480': {'state': 'Arizona', 'city': 'Phoenix',    'region': 'Arizona'},
    '928': {'state': 'Arizona', 'city': 'Flagstaff',  'region': 'Arizona'},
    # Minnesota
    '952': {'state': 'Minnesota', 'city': 'Minneapolis', 'region': 'Minnesota'},
    '507': {'state': 'Minnesota', 'city': 'Rochester',   'region': 'Minnesota'},
    # New Mexico
    '505': {'state': 'New Mexico', 'city': 'Albuquerque', 'region': 'New Mexico'},
    '575': {'state': 'New Mexico', 'city': 'Roswell',     'region': 'New Mexico'},
    # DC
    '202': {'state': 'DC', 'city': 'Washington', 'region': 'DC'},
    # Massachusetts
    '508': {'state': 'Massachusetts', 'city': 'Worcester',   'region': 'Massachusetts'},
    '978': {'state': 'Massachusetts', 'city': 'Lowell',      'region': 'Massachusetts'},
    '857': {'state': 'Massachusetts', 'city': 'Boston',      'region': 'Massachusetts'},
    '413': {'state': 'Massachusetts', 'city': 'Springfield', 'region': 'Massachusetts'},
    # Delaware
    '302': {'state': 'Delaware', 'city': 'Wilmington', 'region': 'Delaware'},
    # New Hampshire
    '603': {'state': 'New Hampshire', 'city': 'Manchester', 'region': 'New Hampshire'},
    # Rhode Island
    '401': {'state': 'Rhode Island', 'city': 'Providence', 'region': 'Rhode Island'},
    # Utah
    '801': {'state': 'Utah', 'city': 'Salt Lake City', 'region': 'Utah'},
    # Alaska
    '907': {'state': 'Alaska', 'city': 'Anchorage', 'region': 'Alaska'},
    # Hawaii
    '808': {'state': 'Hawaii', 'city': 'Honolulu', 'region': 'Hawaii'},
    # Maine
    '207': {'state': 'Maine', 'city': 'Portland', 'region': 'Maine'},
    # West Virginia
    '304': {'state': 'West Virginia', 'city': 'Charleston', 'region': 'West Virginia'},
    # Puerto Rico
    '787': {'state': 'Puerto Rico', 'city': 'San Juan', 'region': 'Puerto Rico'},
    # Canada
    '403': {'state': 'Canada', 'city': 'Calgary',  'region': 'Canada'},
    '548': {'state': 'Canada', 'city': 'Ontario',  'region': 'Canada'},
    # Montana
    '406': {'state': 'Montana', 'city': 'Billings', 'region': 'Montana'},
    # Toll-free / unroutable
    '888': {'state': 'Unknown', 'city': 'Toll-Free', 'region': 'Other'},
}

def clean_phone(phone):
    """Clean phone to 10-digit format"""
    if pd.isna(phone):
        return None
    cleaned = ''.join(c for c in str(phone) if c.isdigit())
    if len(cleaned) == 11 and cleaned.startswith('1'):
        cleaned = cleaned[1:]
    return cleaned if len(cleaned) == 10 else None

def normalize_phone(p):
    """Strip all non-digits, return last 10 digits"""
    import re
    if pd.isna(p):
        return None
    digits = re.sub(r'\D', '', str(p))
    return digits[-10:] if len(digits) >= 10 else None

def get_area_code_info(phone):
    """Extract area code and map to region"""
    if pd.isna(phone):
        return None, 'Unknown', 'Unknown', 'Unknown'
    
    phone_clean = clean_phone(phone)
    if not phone_clean or len(phone_clean) < 3:
        return None, 'Unknown', 'Unknown', 'Unknown'
    
    area_code = phone_clean[:3]
    info = AREA_CODE_MAP.get(area_code, {
        'state': 'Other',
        'city': 'Other',
        'region': 'Other'
    })
    
    return area_code, info['city'], info['state'], info['region']


class DataTransformer:
    """V4.1: NO PHONE MATCHING + PROPER SHOW MATCHING + NEW OUTPUTS"""

    def __init__(self, data):
        self.raw_data = data
        self.first_visits = data.get('first_visits')
        
    def transform(self, manual_tracker_path=None):
        """Main transformation"""
        logger.info("="*70)
        logger.info("STARTING V4.0 TRANSFORMATION (NO PHONE MATCHING)")
        logger.info("="*70)
        
        # Transform data
        calls = self._transform_calls(self.raw_data['calls'])
        bookings = self._transform_bookings(
            self.raw_data['bookings'],
            first_visits=self.raw_data.get('first_visits')
        )
        
        # Build validation FIRST so gap_details can feed unified leads
        validation_outputs = {}
        gap_details = None
        if manual_tracker_path:
            validation_outputs = self._build_validation(bookings, manual_tracker_path)
            gap_details = validation_outputs.get('validation_lead_details')

        # Build lead funnel and unified leads (ClubReady + manual tracker merge)
        lead_funnel   = self._build_lead_funnel(bookings, calls)
        unified_leads = self._build_unified_leads(lead_funnel, gap_details)

        outputs = {
            'calls': calls,
            'bookings': bookings,
            'daily_performance': self._build_daily_performance(calls, bookings),
            'by_studio': self._build_by_studio(bookings, calls, unified_leads=unified_leads),
            'by_area_code': self._build_by_area_code(calls, bookings),
            'pipeline': self._build_pipeline(bookings, calls),
            'call_timing': self._build_call_timing(calls),
            'lead_funnel': lead_funnel,
            'unified_leads': unified_leads,
            'cancellation_analysis': self._build_cancellation_analysis(bookings),
            'booking_outcomes': self._build_booking_outcomes(bookings),
            'booking_window_analysis': self._build_booking_window(bookings),
            'day_of_week_performance': self._build_day_of_week(bookings),
            'root_cause_analysis': self._build_root_cause(bookings, calls),
            # V4.1 new outputs
            'conversion_trends': self._build_conversion_trends(bookings, calls),
            'loyalsnap_engagement': self._build_loyalsnap_engagement(),
            'flexologist_performance': self._build_flexologist_performance(bookings),
            'ramp_vs_target': self._build_ramp_vs_target(bookings, calls),
            'velocity_trend': self._build_velocity_trend(lead_funnel, calls),
        }

        # Unattributed flags — output only, does not affect any booking or show counts
        flags_df = self._build_unattributed_flags(
            outputs.get('calls', pd.DataFrame()),
            outputs.get('bookings', pd.DataFrame()),
            self.raw_data.get('first_visits', pd.DataFrame())
        )
        if len(flags_df) > 0:
            outputs['unattributed_flags'] = flags_df
            logger.info(f"\n  UNATTRIBUTED FLAGS: {len(flags_df)} leads flagged for Brian review")

        # Annotate validation_report with manual-tracker-only flags for Action Plan
        if validation_outputs and 'validation_report' in validation_outputs:
            vr = validation_outputs['validation_report']
            manual_only_rows = unified_leads[unified_leads['source'] == 'manual_tracker']

            vr['unlogged_attended'] = [
                {
                    'name':     f"{r['first_name']} {r['last_name']}".strip(),
                    'location': str(r['booking_location'] or ''),
                    'date':     str(r['booking_date'] or ''),
                }
                for _, r in manual_only_rows[manual_only_rows['unified_outcome'] == 'attended'].iterrows()
            ]

            cr_first_names = set(
                unified_leads[unified_leads['source'] != 'manual_tracker']['first_name']
                .astype(str).str.strip().str.lower()
            )
            vr['possible_duplicates'] = [
                {
                    'name':     f"{r['first_name']} {r['last_name']}".strip(),
                    'location': str(r['booking_location'] or ''),
                    'outcome':  str(r['unified_outcome'] or ''),
                    'date':     str(r['booking_date'] or ''),
                    'note':     'First name matches a ClubReady lead — verify if same person',
                }
                for _, r in manual_only_rows.iterrows()
                if str(r.get('first_name') or '').strip().lower() in cr_first_names
            ]

        # Merge validation outputs (validation_report + validation_lead_details)
        if validation_outputs:
            outputs.update(validation_outputs)

        # Project bookings and lead_funnel to clean output columns only.
        # Drops raw Excel pass-through columns (Source Store ID, Log Date, Booking Made By, etc.)
        # and internal pipeline columns (matched_by_user_id, full_name_lower, matched_by_name,
        # _booking_date_str, user_id). All internal columns were needed until this point.
        _BOOKING_COLS = [
            'booking_id', 'first_name', 'last_name', 'email', 'phone_clean',
            'booking_location', 'booking_date', 'booking_event', 'current_status',
            'booking_outcome', 'has_show', 'is_no_show', 'is_scheduled',
            'is_cancelled', 'is_cancelled_admin', 'is_cancelled_customer',
            'is_future', 'is_past', 'is_resolved',
            'session_mins', 'attribution_method',
            'area_code', 'city', 'state', 'region',
            'booking_day_of_week', 'booking_hour', 'days_to_booking',
        ]
        _LEAD_FUNNEL_COLS = _BOOKING_COLS + [
            'total_calls', 'first_call_date', 'last_call_date',
            'has_call_record', 'days_first_call_to_booking',
        ]
        for key, col_list in [('bookings', _BOOKING_COLS), ('lead_funnel', _LEAD_FUNNEL_COLS)]:
            if key in outputs and len(outputs[key]) > 0:
                present = [c for c in col_list if c in outputs[key].columns]
                outputs[key] = outputs[key][present].copy()

        logger.info("="*70)
        logger.info("TRANSFORMATION COMPLETE")
        logger.info("="*70)

        return outputs
    
    def _transform_calls(self, calls):
        """Transform call data"""
        logger.info("\nTRANSFORMING CALLS...")
        
        # Parse datetime
        calls['call_start_time'] = pd.to_datetime(calls['call_start_time'], errors='coerce')
        calls['date'] = calls['call_start_time'].dt.date
        calls['hour'] = calls['call_start_time'].dt.hour
        calls['day_of_week'] = calls['call_start_time'].dt.day_name()
        
        # Parse durations
        def parse_timedelta(td):
            if pd.isna(td):
                return 0
            if isinstance(td, pd.Timedelta):
                return td.total_seconds() / 60
            return 0
        
        calls['live_talk_min'] = calls['live_talk_time'].apply(parse_timedelta)
        calls['ringing_min'] = calls['ringing_time'].apply(parse_timedelta)
        calls['call_length_min'] = calls['call_length'].apply(parse_timedelta)
        
        # Filter outbound only
        calls = calls[calls['call_direction'] == 'Outbound'].copy()
        
        # Engagement
        calls['is_connected'] = (calls['call_response'] == 'Connected').astype(int)
        
        # Clean phone
        calls['to_number_clean'] = calls['to_number'].apply(clean_phone)
        
        # Area code
        calls[['area_code', 'city', 'state', 'region']] = calls['to_number'].apply(
            lambda x: pd.Series(get_area_code_info(x))
        )
        
        logger.info(f"  {len(calls):,} outbound calls")
        return calls
    
    def _transform_bookings(self, bookings, first_visits=None):
        """Transform booking data - CRITICAL: Direct + Tamryn ONLY + Proper Show Matching"""
        logger.info("\nTRANSFORMING BOOKINGS...")
        
        initial_count = len(bookings)
        logger.info(f"  Total booking events in database: {initial_count:,}")
        
        # TIER 1: DIRECT - Phiwe logged it
        phiwe_events = bookings[bookings['Booking Made By'] == 'Phiwe Khasa'].copy()
        logger.info(f"  Phiwe events: {len(phiwe_events)}")
        
        # Deduplicate - keep LATEST event per booking
        phiwe_events['Booking Last Modified Date'] = pd.to_datetime(
            phiwe_events['Booking Last Modified Date'], errors='coerce'
        )
        phiwe_events = phiwe_events.sort_values('Booking Last Modified Date')
        phiwe_bookings = phiwe_events.drop_duplicates(subset=['Booking ID'], keep='last')
        
        logger.info(f"  Tier 1 - Direct (Phiwe logged): {len(phiwe_bookings)} unique bookings")
        
        # TIER 2: TAMRYN OVERRIDE - Tamryn logged for Phiwe
        tamryn_events = bookings[bookings['Booking Made By'] == 'Tamryn Montgomery'].copy()
        tamryn_events['Booking Last Modified Date'] = pd.to_datetime(
            tamryn_events['Booking Last Modified Date'], errors='coerce'
        )
        tamryn_events = tamryn_events.sort_values('Booking Last Modified Date')
        tamryn_bookings = tamryn_events.drop_duplicates(subset=['Booking ID'], keep='last')
        
        logger.info(f"  Tier 2 - Tamryn Override: {len(tamryn_bookings)} unique bookings")

        # TIER 3: FORCE-ATTRIBUTED LEADS — confirmed by Tamryn, logged under other staff
        from config import FORCE_ATTRIBUTED_LEADS
        force_user_ids = {str(l['user_id']) for l in FORCE_ATTRIBUTED_LEADS if l.get('user_id')}
        force_names    = {(l['first_name'].lower(), l['last_name'].lower()) for l in FORCE_ATTRIBUTED_LEADS}

        # Build a (name_lower, date_str) allowlist so name-matched rows are pinned to a specific date
        force_name_dates = {
            (l['first_name'].lower(), l['last_name'].lower()): l.get('booking_date')
            for l in FORCE_ATTRIBUTED_LEADS
        }

        tier3_id   = bookings[bookings['User ID'].astype(str).isin(force_user_ids)].copy()
        tier3_name = bookings[
            bookings.apply(
                lambda r: (
                    str(r.get('First Name', '')).strip().lower(),
                    str(r.get('Last Name',  '')).strip().lower()
                ) in force_names, axis=1
            )
        ].copy()
        tier3_raw = pd.concat([tier3_id, tier3_name], ignore_index=True)
        if len(tier3_raw):
            tier3_raw['Booking Last Modified Date'] = pd.to_datetime(
                tier3_raw['Booking Last Modified Date'], errors='coerce'
            )
            tier3_raw['_booking_date_str'] = pd.to_datetime(
                tier3_raw['Booking Date'], errors='coerce'
            ).dt.strftime('%Y-%m-%d')
            # Filter name-matched rows to their pinned booking date
            def _keep_row(r):
                key = (str(r.get('First Name', '')).strip().lower(),
                       str(r.get('Last Name',  '')).strip().lower())
                pin = force_name_dates.get(key)
                if pin is None:
                    return True  # user_id matched — no date restriction needed
                return r['_booking_date_str'] == pin
            tier3_raw = tier3_raw[tier3_raw.apply(_keep_row, axis=1)]
            tier3_raw = tier3_raw.sort_values('Booking Last Modified Date')
        tier3_bookings = tier3_raw.drop_duplicates(subset=['Booking ID'], keep='last')
        # Remove any already captured by Tier 1 or Tier 2
        existing_ids = set(phiwe_bookings['Booking ID'].tolist()) | set(tamryn_bookings['Booking ID'].tolist())
        tier3_bookings = tier3_bookings[~tier3_bookings['Booking ID'].isin(existing_ids)]
        logger.info(f"  Tier 3 - Force attributed: {len(tier3_bookings)} unique bookings")

        # COMBINE - NO PHONE MATCHING
        all_bookings = pd.concat([phiwe_bookings, tamryn_bookings, tier3_bookings]).drop_duplicates(
            subset=['Booking ID']
        )

        logger.info(f"\n  {'='*60}")
        logger.info(f"  TOTAL PHIWE BOOKINGS: {len(all_bookings)}")
        logger.info(f"  {'='*60}")
        logger.info(f"  From {initial_count:,} total events in database")
        logger.info(f"  Direct: {len(phiwe_bookings)} + Tamryn: {len(tamryn_bookings)} + Force: {len(tier3_bookings)}")
        
        # Set attribution — Tamryn books on Phiwe's behalf, attribute all as Direct
        all_bookings['attribution_method'] = 'Direct'
        
        # Transform fields (now with first_visits and full events log for cross-ref)
        bookings_transformed = self._transform_booking_fields(
            all_bookings, first_visits, all_events=bookings
        )

        return bookings_transformed

    def _transform_booking_fields(self, bookings, first_visits=None, all_events=None):
        """Transform booking fields WITH PROPER SHOW MATCHING"""
        # Parse dates
        bookings['booking_date'] = pd.to_datetime(bookings['Booking Date'], errors='coerce')
        bookings['booking_datetime'] = pd.to_datetime(bookings['Booking Start'], errors='coerce')
        bookings['created_date'] = pd.to_datetime(bookings['Booking Last Modified Date'], errors='coerce')
        bookings['log_date'] = pd.to_datetime(bookings['Log Date'], errors='coerce')
        
        # Determine today
        today = bookings['log_date'].max() if bookings['log_date'].notna().any() else pd.Timestamp.now()
        
        # Extract fields
        bookings['booking_id'] = bookings['Booking ID']
        bookings['user_id'] = bookings['User ID']
        bookings['first_name'] = bookings['First Name']
        bookings['last_name'] = bookings['Last Name']
        bookings['email'] = bookings['Email']
        bookings['phone'] = bookings['Phone']
        bookings['cell_phone'] = bookings['Cell Phone']
        bookings['work_phone'] = bookings['Work Phone']
        bookings['booking_location'] = bookings['Booking Location']
        # Normalize booking_location — fixes typos from raw ClubReady export.
        # Add entries here whenever a new typo is discovered in the source data.
        _LOCATION_FIXES = {
            'stretchlab shrepeort': 'StretchLab Shreveport',
        }
        bookings['booking_location'] = (
            bookings['booking_location']
            .astype(str)
            .str.strip()
            .apply(lambda x: _LOCATION_FIXES.get(x.strip().lower(), x.strip()))
        )
        bookings['session_mins'] = pd.to_numeric(bookings['Session Mins'], errors='coerce')
        bookings['booking_event'] = bookings['Booking Event']
        bookings['current_status'] = bookings['Current Status'].astype(str).str.strip()
        # Tamryn books on Phiwe's behalf — normalise booking_made_by to Phiwe for all records
        bookings['booking_made_by'] = bookings['Booking Made By'].replace(
            'Tamryn Montgomery', 'Phiwe Khasa'
        )
        
        # Clean phone
        bookings['phone_clean'] = bookings.apply(lambda row: 
            clean_phone(row.get('cell_phone')) or 
            clean_phone(row.get('phone')) or 
            clean_phone(row.get('work_phone')),
            axis=1
        )
        
        # Area code
        bookings[['area_code', 'city', 'state', 'region']] = bookings['cell_phone'].apply(
            lambda x: pd.Series(get_area_code_info(x))
        )
        
        # Day of week
        bookings['booking_day_of_week'] = bookings['booking_date'].dt.day_name()
        bookings['booking_hour'] = bookings['booking_datetime'].dt.hour
        
        # Booking window
        bookings['days_to_booking'] = (
            bookings['booking_date'] - bookings['created_date']
        ).dt.days
        
        # Future vs past
        bookings['is_future'] = (bookings['booking_date'] > today).astype(int)
        bookings['is_past'] = (bookings['booking_date'] <= today).astype(int)

        # Resolved denominator: past appointments whose outcome is final
        # Rescheduled = is_past=1 but outcome still pending — exclude from resolved
        bookings['is_resolved'] = (
            (bookings['is_past'] == 1) &
            (~bookings['current_status'].str.contains('Rescheduled', na=False))
        ).astype(int)
        
        # CRITICAL FIX: PROPER SHOW MATCHING WITH first_visits SHEET
        # Initialize all as Unknown first
        bookings['booking_outcome'] = 'Unknown'
        
        # Start with booking events (will be overridden by first_visits if found)
        bookings.loc[bookings['booking_event'] == 'Booking Cancelled', 'booking_outcome'] = 'Cancelled'
        bookings.loc[bookings['booking_event'] == 'No-Show', 'booking_outcome'] = 'No-Show'
        bookings.loc[bookings['booking_event'] == 'New Booking Made', 'booking_outcome'] = 'New'
        
        # Save baseline outcomes (after booking_event init) before any Completed assignments.
        # The dedup runs after ALL sources (first_visits + cross-ref) have marked Completed,
        # so it reverts to this snapshot — not an intermediate state that the cross-ref would undo.
        bookings['_pre_match_outcome'] = bookings['booking_outcome'].copy()

        # Match with first_visits (THIS OVERRIDES booking events)
        if first_visits is not None and len(first_visits) > 0:
            logger.info(f"\n  MATCHING WITH FIRST_VISITS SHEET...")

            # Get completed first visits
            completed_visits = first_visits[first_visits['Status'] == 'Complete'].copy()
            logger.info(f"    Total completed first visits: {len(completed_visits)}")

            # Match by User ID (primary key)
            visit_user_ids = set(completed_visits['User ID'].dropna())
            bookings['matched_by_user_id'] = bookings['user_id'].isin(visit_user_ids)
            user_id_matches = bookings['matched_by_user_id'].sum()
            logger.info(f"    Matched by User ID: {user_id_matches}")

            # Match by name (secondary key for missing User IDs)
            completed_visits['full_name'] = (
                completed_visits['First Name'].fillna('') + ' ' +
                completed_visits['Last Name'].fillna('')
            ).str.lower().str.strip()

            bookings['full_name_lower'] = (
                bookings['first_name'].fillna('') + ' ' +
                bookings['last_name'].fillna('')
            ).str.lower().str.strip()

            visit_names = set(completed_visits['full_name'])
            bookings['matched_by_name'] = (
                bookings['full_name_lower'].isin(visit_names) &
                ~bookings['matched_by_user_id']
            )
            name_matches = bookings['matched_by_name'].sum()
            logger.info(f"    Matched by Name (additional): {name_matches}")

            # CRITICAL: Mark as Completed if matched in first_visits
            # This OVERRIDES any previous outcome assignment
            bookings.loc[
                (bookings['matched_by_user_id'] | bookings['matched_by_name']),
                'booking_outcome'
            ] = 'Completed'

            total_shows = (bookings['booking_outcome'] == 'Completed').sum()
            logger.info(f"    TOTAL SHOWS after first_visits match: {total_shows}")

        # STEP 2: Booking Completed event cross-reference (ClubReady data only)
        # Sessions logged as 'Booking Completed' by internal staff on behalf of Phiwe leads
        # are missed by first_visits matching because the Phiwe booking row carries a
        # Cancelled status. Cross-referencing by User ID against the full events log
        # catches these without touching the manual tracker.
        if all_events is not None and len(all_events) > 0:
            completed_events = all_events[
                all_events['Booking Event'] == 'Booking Completed'
            ]
            completed_user_ids = set(
                completed_events['User ID'].dropna().astype(str)
            )
            needs_update = (
                bookings['user_id'].astype(str).isin(completed_user_ids) &
                (bookings['booking_outcome'] != 'Completed')
            )
            bookings.loc[needs_update, 'booking_outcome'] = 'Completed'
            if needs_update.sum() > 0:
                logger.info(f"    Booking Completed cross-ref: {needs_update.sum()} booking(s) updated")
                for _, row in bookings[needs_update].iterrows():
                    logger.info(f"      → {row['first_name']} {row['last_name']} ({row['booking_location']})")

        # DEDUP: One attendance per lead — runs after ALL Completed assignments (first_visits + cross-ref).
        # A cancel/reschedule chain can create multiple Phiwe booking records for the same session.
        # Keep only the canonical booking (highest booking_id = most recently created) per user;
        # revert the others to their pre-match baseline so they don't inflate the show count.
        dupes_reverted = 0
        for uid, grp in bookings[bookings['booking_outcome'] == 'Completed'].groupby('user_id'):
            if len(grp) <= 1:
                continue
            canonical_idx = pd.to_numeric(grp['booking_id'], errors='coerce').idxmax()
            to_revert = grp.index[grp.index != canonical_idx]
            bookings.loc[to_revert, 'booking_outcome'] = bookings.loc[to_revert, '_pre_match_outcome']
            dupes_reverted += len(to_revert)
            logger.info(
                f"    Dedup: {grp.loc[canonical_idx, 'first_name']} {grp.loc[canonical_idx, 'last_name']}"
                f" — kept booking_id {grp.loc[canonical_idx, 'booking_id']}, reverted {len(to_revert)}"
            )
        if dupes_reverted:
            logger.info(
                f"    After dedup: {(bookings['booking_outcome'] == 'Completed').sum()} unique shows"
                f" ({dupes_reverted} duplicate(s) reverted)"
            )
        bookings.drop(columns=['_pre_match_outcome'], errors='ignore', inplace=True)

        # Fallback to status for remaining unknowns
        unknown = bookings['booking_outcome'] == 'Unknown'
        bookings.loc[unknown & (bookings['current_status'] == 'Completed Booking'), 'booking_outcome'] = 'Completed'
        bookings.loc[unknown & bookings['current_status'].str.contains('Cancelled', case=False, na=False), 'booking_outcome'] = 'Cancelled'
        bookings.loc[unknown & (bookings['current_status'] == 'No Show Booking'), 'booking_outcome'] = 'No-Show'
        bookings.loc[unknown & (bookings['current_status'] == 'Open Booking - not yet logged'), 'booking_outcome'] = 'Scheduled'
        
        # Boolean flags
        bookings['has_show'] = (bookings['booking_outcome'] == 'Completed').astype(int)
        bookings['is_no_show'] = (bookings['booking_outcome'] == 'No-Show').astype(int)
        bookings['is_scheduled'] = (
            (bookings['booking_outcome'] == 'Scheduled') |
            (bookings['booking_outcome'] == 'New')
        ).astype(int)

        # is_cancelled uses current_status directly — captures all 'Cancelled*' statuses
        # regardless of booking_event, closing the gap where booking_event='New Booking Made'
        # but status was subsequently changed to Cancelled in ClubReady
        bookings['is_cancelled'] = bookings['current_status'].str.contains(
            'Cancelled', na=False
        ).astype(int)
        bookings['is_cancelled_admin'] = bookings['current_status'].str.contains(
            'Cancelled By Admin', na=False
        ).astype(int)
        bookings['is_cancelled_customer'] = (
            (bookings['is_cancelled'] == 1) & (bookings['is_cancelled_admin'] == 0)
        ).astype(int)

        logger.info(f"\n  Booking Outcomes:")
        logger.info(f"    Completed (Shows): {bookings['has_show'].sum()}")
        logger.info(f"    Cancelled (all): {bookings['is_cancelled'].sum()}")
        logger.info(f"      Admin cancel: {bookings['is_cancelled_admin'].sum()}")
        logger.info(f"      Customer cancel: {bookings['is_cancelled_customer'].sum()}")
        logger.info(f"    No-Show: {bookings['is_no_show'].sum()}")
        logger.info(f"    Scheduled/New: {bookings['is_scheduled'].sum()}")
        logger.info(f"    Future: {bookings['is_future'].sum()}")
        
        return bookings
    
    def _build_daily_performance(self, calls, bookings):
        """Build daily performance aggregates"""
        logger.info("\nBuilding daily performance...")
        
        # Aggregate calls by date
        calls_daily = calls.groupby('date').agg({
            'from_name': 'count',
            'is_connected': 'mean',
            'live_talk_min': ['sum', 'mean'],
            'ringing_min': 'mean'
        }).reset_index()
        
        calls_daily.columns = [
            'date', 'outbound_calls', 'engagement_rate',
            'total_talk_time_min', 'avg_call_duration_min', 'avg_ringing_min'
        ]
        calls_daily['engagement_rate_pct'] = calls_daily['engagement_rate'] * 100
        calls_daily = calls_daily.drop('engagement_rate', axis=1)
        
        # Aggregate bookings by date
        bookings_past = bookings[bookings['is_past'] == 1].copy()
        bookings_daily = bookings_past.groupby(bookings_past['booking_date'].dt.date).agg({
            'booking_id': 'count',
            'has_show': 'sum',
            'is_cancelled': 'sum',
            'is_no_show': 'sum'
        }).reset_index()
        
        bookings_daily.columns = ['date', 'new_bookings', 'shows', 'cancellations', 'no_shows']
        
        # Merge — fillna(0) would silently convert int64 count columns to float64, so cast back
        daily = calls_daily.merge(bookings_daily, on='date', how='left').fillna(0)
        for _col in ['new_bookings', 'shows', 'cancellations', 'no_shows']:
            if _col in daily.columns:
                daily[_col] = daily[_col].astype(int)
        
        # Calculate rates
        daily['booking_rate_pct'] = np.where(
            daily['outbound_calls'] > 0,
            (daily['new_bookings'] / daily['outbound_calls']) * 100,
            0
        )
        daily['show_rate_pct'] = np.where(
            daily['new_bookings'] > 0,
            (daily['shows'] / daily['new_bookings']) * 100,
            0
        )
        daily['cancel_rate_pct'] = np.where(
            daily['new_bookings'] > 0,
            (daily['cancellations'] / daily['new_bookings']) * 100,
            0
        )
        
        logger.info(f"  {len(daily)} days")
        return daily
    
    def _build_by_studio(self, bookings, calls, unified_leads=None):
        """Performance by studio — regenerated from unified leads when available."""
        logger.info("\nBuilding studio performance...")

        all_studios = [
            'StretchLab Bellaire', 'StretchLab Brighton', 'StretchLab Bunker Hill',
            'StretchLab Cherry Street', 'StretchLab Clarkston', 'StretchLab Heights',
            'StretchLab Pearland', 'StretchLab River Oaks', 'StretchLab Shreveport',
            'StretchLab South Tulsa',
        ]

        if unified_leads is not None and len(unified_leads) > 0:
            rows = []
            for studio in all_studios:
                sdf = unified_leads[
                    unified_leads['booking_location'].str.strip() == studio.strip()
                ]
                attended    = int((sdf['unified_outcome'] == 'attended').sum())
                upcoming    = int((sdf['unified_outcome'] == 'upcoming').sum())
                cancelled   = int(sdf['unified_outcome'].isin(['cancelled', 'paid_no_show']).sum())
                no_show     = int((sdf['unified_outcome'] == 'no_show').sum())
                rescheduled = int((sdf['unified_outcome'] == 'rescheduled').sum())
                total       = len(sdf)
                denom       = attended + cancelled + no_show
                show_rate   = round(attended / denom * 100, 2) if denom > 0 else 0
                rows.append({
                    'studio': studio, 'bookings': total,
                    'attended': attended, 'upcoming': upcoming,
                    'cancelled': cancelled, 'no_show': no_show,
                    'rescheduled': rescheduled,
                    'show_rate_pct': show_rate,
                })
            total_bk = sum(r['bookings'] for r in rows)
            logger.info(f"  by_studio from unified leads: {total_bk} bookings across {len(all_studios)} studios")
            return pd.DataFrame(rows).sort_values('bookings', ascending=False)

        # Fallback: ClubReady bookings only (no manual tracker provided)
        studio_data = bookings.groupby('booking_location').agg(
            bookings=('booking_id', 'count'),
            shows=('has_show', 'sum'),
            cancellations=('is_cancelled', 'sum'),
            no_shows=('is_no_show', 'sum'),
        ).reset_index().rename(columns={'booking_location': 'studio'})
        all_df   = pd.DataFrame({'studio': all_studios})
        perf     = all_df.merge(studio_data, on='studio', how='left').fillna(0)
        perf['show_rate_pct']   = np.where(perf['bookings'] > 0, perf['shows'] / perf['bookings'] * 100, 0)
        perf['cancel_rate_pct'] = np.where(perf['bookings'] > 0, perf['cancellations'] / perf['bookings'] * 100, 0)
        logger.info(f"  {len(all_studios)} studios (fallback — no unified leads)")
        return perf.sort_values('bookings', ascending=False)
    
    def _build_by_area_code(self, calls, bookings):
        """Performance by area code/region"""
        logger.info("\nBuilding geographic performance...")
        
        # Aggregate calls
        calls_geo = calls.groupby(['area_code', 'city', 'state', 'region']).agg({
            'from_name': 'count',
            'to_number_clean': 'nunique',
            'is_connected': 'mean'
        }).reset_index()
        
        calls_geo.columns = [
            'area_code', 'city', 'state', 'region',
            'total_calls', 'unique_leads', 'engagement_rate'
        ]
        
        # Aggregate bookings
        bookings_geo = bookings.groupby('area_code').agg({
            'booking_id': 'count',
            'has_show': 'sum'
        }).reset_index()
        bookings_geo.columns = ['area_code', 'bookings', 'shows']
        
        # Merge
        geo_perf = calls_geo.merge(bookings_geo, on='area_code', how='left').fillna(0)
        
        # Calculate rates
        geo_perf['booking_rate_pct'] = np.where(
            geo_perf['total_calls'] > 0,
            (geo_perf['bookings'] / geo_perf['total_calls']) * 100,
            0
        )
        geo_perf['show_rate_pct'] = np.where(
            geo_perf['bookings'] > 0,
            (geo_perf['shows'] / geo_perf['bookings']) * 100,
            0
        )
        geo_perf['engagement_rate_pct'] = geo_perf['engagement_rate'] * 100
        geo_perf = geo_perf.drop('engagement_rate', axis=1)
        
        geo_perf = geo_perf.sort_values('total_calls', ascending=False)
        
        logger.info(f"  {len(geo_perf)} area codes/markets")
        return geo_perf
    
    def _build_pipeline(self, bookings, calls):
        """Future bookings pipeline with risk assessment"""
        logger.info("\nBuilding pipeline...")
        
        # Future bookings only — exclude any row whose current_status is cancelled
        # (booking_event='New Booking Made' sets booking_outcome='New', bypassing the
        # is_cancelled flag even when current_status later shows a cancellation)
        pipeline = bookings[
            (bookings['is_future'] == 1) &
            (~bookings['current_status'].str.contains('Cancelled', case=False, na=False))
        ].copy()
        
        if len(pipeline) == 0:
            logger.info("  No future bookings")
            return pd.DataFrame()
        
        # Calculate days until (use date-only comparison so same-day bookings = 0, not -1)
        today = pd.Timestamp.now().normalize()
        pipeline['days_until'] = (pipeline['booking_date'].dt.normalize() - today).dt.days

        # Drop appointments whose booking date has already passed
        pipeline = pipeline[pipeline['days_until'] >= 0].copy()

        if len(pipeline) == 0:
            logger.info("  No future bookings after date filter")
            return pd.DataFrame()

        # Get call count per lead
        call_counts = calls.groupby('to_number_clean')['from_name'].count().reset_index()
        call_counts.columns = ['phone_clean', 'total_calls_made']
        
        pipeline = pipeline.merge(call_counts, on='phone_clean', how='left')
        pipeline['total_calls_made'] = pipeline['total_calls_made'].fillna(0)
        
        # Risk assessment
        def assess_risk(row):
            if row['total_calls_made'] < 3 or row['days_until'] > 14:
                return 'High'
            elif row['total_calls_made'] < 5 or row['days_until'] > 7:
                return 'Medium'
            else:
                return 'Low'
        
        pipeline['risk_level'] = pipeline.apply(assess_risk, axis=1)
        
        # Select columns
        pipeline_output = pipeline[[
            'booking_id', 'first_name', 'last_name', 'phone_clean', 'email',
            'booking_date', 'days_until', 'booking_location', 'session_mins',
            'total_calls_made', 'risk_level', 'attribution_method'
        ]].copy()
        
        logger.info(f"  {len(pipeline)} future bookings")
        logger.info(f"    High risk: {(pipeline['risk_level'] == 'High').sum()}")
        logger.info(f"    Medium risk: {(pipeline['risk_level'] == 'Medium').sum()}")
        logger.info(f"    Low risk: {(pipeline['risk_level'] == 'Low').sum()}")
        
        return pipeline_output
    
    def _build_call_timing(self, calls):
        """Call timing heatmap"""
        logger.info("\nBuilding call timing...")
        
        timing = calls.groupby(['day_of_week', 'hour']).agg({
            'from_name': 'count',
            'is_connected': 'mean'
        }).reset_index()
        
        timing.columns = ['day_of_week', 'hour', 'total_calls', 'engagement_rate']
        timing['engagement_rate_pct'] = timing['engagement_rate'] * 100
        timing = timing.drop('engagement_rate', axis=1)
        
        # Sort by day order
        day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        timing['day_order'] = timing['day_of_week'].map({d: i for i, d in enumerate(day_order)})
        timing = timing.sort_values(['day_order', 'hour']).drop('day_order', axis=1)
        
        logger.info(f"  {len(timing)} time slots")
        return timing
    
    def _build_lead_funnel(self, bookings, calls):
        """Lead-level funnel with call history"""
        logger.info("\nBuilding lead funnel...")
        
        # Get call summary per phone
        call_summary = calls.groupby('to_number_clean').agg({
            'call_start_time': ['count', 'min', 'max']
        }).reset_index()
        call_summary.columns = ['phone_clean', 'total_calls', 'first_call_date', 'last_call_date']
        
        # Merge with bookings
        funnel = bookings.merge(call_summary, on='phone_clean', how='left')
        funnel['total_calls'] = funnel['total_calls'].fillna(0)
        funnel['has_call_record'] = (funnel['total_calls'] > 0).astype(int)
        
        # Days from first call to booking
        funnel['days_first_call_to_booking'] = (
            funnel['booking_date'] - pd.to_datetime(funnel['first_call_date'])
        ).dt.days
        
        logger.info(f"  {len(funnel)} leads")
        logger.info(f"    With call records: {funnel['has_call_record'].sum()}")
        return funnel

    def _build_unified_leads(self, lead_funnel, gap_details=None):
        """Merge ClubReady lead funnel with manual tracker. Produces phiwe_unified_leads.csv."""
        logger.info("\nBuilding unified leads (ClubReady + manual tracker merge)...")

        STATUS_TO_OUTCOME = {
            'completed booking':                    'attended',
            'open booking - not yet logged':        'upcoming',
            'no show booking':                      'no_show',
            'rescheduled by admin':                 'rescheduled',
            'cancelled within policy rules':        'cancelled',
            'cancelled outside policy rules':       'cancelled',
            'cancelled by admin':                   'cancelled',
        }

        def map_outcome(status):
            s = str(status or '').strip().lower()
            for key, val in STATUS_TO_OUTCOME.items():
                if key in s:
                    return val
            return 'upcoming'  # safe default for unknown statuses

        def norm_location(loc):
            loc = str(loc or '').strip()
            if not loc.lower().startswith('stretchlab'):
                return f'StretchLab {loc}'
            return loc

        # ── ClubReady base: Phiwe-only bookings ──────────────────────────────
        funnel = lead_funnel[
            lead_funnel['booking_made_by'].astype(str).str.lower().str.contains('phiwe', na=False)
        ].copy()
        funnel['_norm']           = funnel['full_name_lower'].apply(_norm_name)
        funnel['unified_outcome'] = funnel['current_status'].apply(map_outcome)
        # has_show=1 is the authoritative attended flag — override current_status-derived
        # outcome for leads like Joe Fanto whose status was later set to 'Cancelled By Admin'
        # even though they actually attended the session.
        if 'has_show' in funnel.columns:
            funnel.loc[funnel['has_show'] == 1, 'unified_outcome'] = 'attended'
        funnel['source']          = 'clubready'
        funnel['held']            = ''
        funnel['paid']            = ''

        manual_only_rows = pd.DataFrame()

        if gap_details is not None and len(gap_details) > 0:
            val = gap_details.copy()
            val['_norm']      = val['name'].apply(_norm_name).apply(lambda n: _NAME_CORRECTIONS.get(n, n) if n else n)
            val['held_clean'] = val['held'].astype(str).str.strip().str.lower()
            val['paid_clean'] = val['paid'].astype(str).str.strip().str.lower()

            # Override: manual tracker held=Yes + ClubReady status=Cancelled → attended
            held_norms    = set(val.loc[val['held_clean'] == 'yes', '_norm'].dropna())
            cancel_mask   = funnel['current_status'].str.contains('Cancelled', na=False, case=False)
            override_mask = funnel['_norm'].isin(held_norms) & cancel_mask
            funnel.loc[override_mask, 'unified_outcome'] = 'attended'
            funnel.loc[override_mask, 'source']          = 'both'

            # Mark other ClubReady rows that appear in the manual tracker
            all_val_norms = set(val['_norm'].dropna())
            funnel.loc[
                funnel['_norm'].isin(all_val_norms) & (funnel['source'] == 'clubready'),
                'source'
            ] = 'both'

            # Manual-tracker-only leads (name not found in ClubReady funnel)
            funnel_norms = set(funnel['_norm'].dropna())
            manual_only  = val[~val['_norm'].isin(funnel_norms)].copy()

            _now = pd.Timestamp.now()

            def derive_outcome(row):
                held = row['held_clean']
                paid = row['paid_clean']
                appt = pd.to_datetime(row.get('date_of_appointment'), errors='coerce')
                is_future = pd.notna(appt) and appt > _now
                if held == 'yes':
                    return 'attended'
                if is_future:
                    return 'upcoming'
                if held in ('nan', 'none', 'nat', '', '<na>'):
                    return 'upcoming'
                if paid == 'yes':
                    return 'paid_no_show'
                return 'cancelled'

            if len(manual_only) > 0:
                manual_only = manual_only.copy()
                manual_only['unified_outcome'] = manual_only.apply(derive_outcome, axis=1)
                name_parts = manual_only['name'].str.strip().str.split(r'\s+', n=1, expand=True)
                manual_only_rows = pd.DataFrame({
                    'unified_outcome':  manual_only['unified_outcome'].values,
                    'booking_location': manual_only['location'].apply(norm_location).values,
                    'first_name':       name_parts[0].fillna('').values,
                    'last_name':        (name_parts[1].fillna('').values if 1 in name_parts.columns else ['']*len(manual_only)),
                    'booking_date':     pd.to_datetime(manual_only['date_of_appointment'], errors='coerce').values,
                    'source':           'manual_tracker',
                    'held':             manual_only['held'].astype(str).values,
                    'paid':             manual_only['paid'].astype(str).values,
                    'current_status':   None,
                    'booking_made_by':  None,
                })
                logger.info(f"  Manual-tracker-only leads added: {len(manual_only_rows)}")

        out_cols = ['unified_outcome', 'booking_location', 'first_name', 'last_name',
                    'booking_date', 'source', 'held', 'paid', 'current_status', 'booking_made_by']
        funnel_out = funnel.reindex(columns=out_cols)

        if len(manual_only_rows) > 0:
            result = pd.concat([funnel_out, manual_only_rows.reindex(columns=out_cols)], ignore_index=True)
        else:
            result = funnel_out.reset_index(drop=True)

        logger.info(f"  Unified leads: {len(result)} total "
                    f"({len(funnel_out)} ClubReady + {len(manual_only_rows)} manual-only)")
        return result

    def _build_cancellation_analysis(self, bookings):
        """Detailed cancellation analysis"""
        logger.info("\nBuilding cancellation analysis...")
        
        cancelled = bookings[bookings['is_cancelled'] == 1].copy()
        
        if len(cancelled) == 0:
            logger.info("  No cancellations")
            return pd.DataFrame()
        
        # WHO cancelled?
        cancelled['cancelled_by'] = 'Customer'
        cancelled.loc[
            cancelled['current_status'].str.contains('Admin', case=False, na=False),
            'cancelled_by'
        ] = 'Admin'
        
        # WHEN cancelled?
        cancelled['days_before_appointment'] = (
            cancelled['booking_date'] - cancelled['created_date']
        ).dt.days.abs()
        
        cancelled['cancellation_timing'] = 'Unknown'
        cancelled.loc[cancelled['days_before_appointment'] < 1, 'cancellation_timing'] = 'Last Minute (<24hr)'
        cancelled.loc[
            (cancelled['days_before_appointment'] >= 1) & (cancelled['days_before_appointment'] < 7),
            'cancellation_timing'
        ] = 'Short Notice (1-7 days)'
        cancelled.loc[cancelled['days_before_appointment'] >= 7, 'cancellation_timing'] = 'Advance (7+ days)'
        
        # Booking window
        cancelled['booking_window_days'] = cancelled['days_to_booking']
        cancelled['booking_window_category'] = 'Unknown'
        cancelled.loc[cancelled['booking_window_days'] < 7, 'booking_window_category'] = '<7 days'
        cancelled.loc[
            (cancelled['booking_window_days'] >= 7) & (cancelled['booking_window_days'] < 14),
            'booking_window_category'
        ] = '7-14 days'
        cancelled.loc[
            (cancelled['booking_window_days'] >= 14) & (cancelled['booking_window_days'] < 30),
            'booking_window_category'
        ] = '14-30 days'
        cancelled.loc[cancelled['booking_window_days'] >= 30, 'booking_window_category'] = '30+ days'
        
        # Select relevant columns
        cancel_analysis = cancelled[[
            'booking_id', 'first_name', 'last_name', 'booking_location',
            'cancelled_by', 'cancellation_timing', 'days_before_appointment',
            'booking_window_category', 'booking_window_days',
            'booking_day_of_week', 'booking_date', 'current_status'
        ]].copy()
        
        logger.info(f"  {len(cancel_analysis)} cancellations")
        logger.info(f"    By customer: {(cancel_analysis['cancelled_by'] == 'Customer').sum()}")
        logger.info(f"    By admin: {(cancel_analysis['cancelled_by'] == 'Admin').sum()}")
        
        return cancel_analysis
    
    def _build_booking_outcomes(self, bookings):
        """Booking outcomes segmentation"""
        logger.info("\nBuilding booking outcomes...")
        
        outcomes = bookings.groupby(['booking_event', 'current_status']).size().reset_index(name='count')
        outcomes['percentage'] = (outcomes['count'] / len(bookings) * 100).round(1)
        
        logger.info(f"  {len(outcomes)} outcome segments")
        return outcomes
    
    def _build_booking_window(self, bookings):
        """Booking window analysis"""
        logger.info("\nBuilding booking window analysis...")
        
        # Categorize by window
        bookings_copy = bookings.copy()
        bookings_copy['window_category'] = 'Unknown'
        bookings_copy.loc[bookings_copy['days_to_booking'] < 7, 'window_category'] = '<7 days'
        bookings_copy.loc[
            (bookings_copy['days_to_booking'] >= 7) & (bookings_copy['days_to_booking'] < 14),
            'window_category'
        ] = '7-14 days'
        bookings_copy.loc[
            (bookings_copy['days_to_booking'] >= 14) & (bookings_copy['days_to_booking'] < 30),
            'window_category'
        ] = '14-30 days'
        bookings_copy.loc[bookings_copy['days_to_booking'] >= 30, 'window_category'] = '30+ days'
        
        # Aggregate
        window_analysis = bookings_copy.groupby('window_category').agg({
            'booking_id': 'count',
            'is_cancelled': 'sum',
            'has_show': 'sum'
        }).reset_index()
        
        window_analysis.columns = ['window_category', 'total_bookings', 'cancelled', 'shows']
        
        window_analysis['cancel_rate_pct'] = np.where(
            window_analysis['total_bookings'] > 0,
            (window_analysis['cancelled'] / window_analysis['total_bookings']) * 100,
            0
        )
        window_analysis['show_rate_pct'] = np.where(
            window_analysis['total_bookings'] > 0,
            (window_analysis['shows'] / window_analysis['total_bookings']) * 100,
            0
        )
        
        logger.info(f"  {len(window_analysis)} window categories")
        return window_analysis
    
    def _build_day_of_week(self, bookings):
        """Day of week performance"""
        logger.info("\nBuilding day of week analysis...")
        
        # Attended leads sometimes carry is_cancelled=1 (status updated after the fact).
        # Use has_show=1 as authoritative for shows; exclude those from cancellations/no-shows.
        # Use current_status string match for no-shows (is_no_show flag unreliable due to
        # trailing spaces in status values like 'No Show Booking ').
        bk = bookings.copy()
        bk['_adj_cancelled'] = ((bk['is_cancelled'] == 1) & (bk['has_show'] != 1)).astype(int)
        bk['_adj_no_show']   = (
            bk['current_status'].str.strip().str.contains('No Show', case=False, na=False) &
            (bk['has_show'] != 1)
        ).astype(int)

        dow_analysis = bk.groupby('booking_day_of_week').agg({
            'booking_id':    'count',
            'has_show':      'sum',
            '_adj_cancelled':'sum',
            '_adj_no_show':  'sum'
        }).reset_index()

        dow_analysis.columns = ['day_of_week', 'total_bookings', 'shows', 'cancellations', 'no_shows']
        
        dow_analysis['show_rate_pct'] = np.where(
            dow_analysis['total_bookings'] > 0,
            (dow_analysis['shows'] / dow_analysis['total_bookings']) * 100,
            0
        )
        dow_analysis['cancel_rate_pct'] = np.where(
            dow_analysis['total_bookings'] > 0,
            (dow_analysis['cancellations'] / dow_analysis['total_bookings']) * 100,
            0
        )
        
        # Sort by day order
        day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        dow_analysis['day_order'] = dow_analysis['day_of_week'].map({d: i for i, d in enumerate(day_order)})
        dow_analysis = dow_analysis.sort_values('day_order').drop('day_order', axis=1)
        
        logger.info(f"  {len(dow_analysis)} days")
        return dow_analysis
    
    def _build_root_cause(self, bookings, calls=None):
        """Root cause analysis — V4.1: low_calls now correctly counts only
        cancellations where the lead had fewer than 3 total calls made."""
        logger.info("\nBuilding root cause analysis...")

        cancelled = bookings[bookings['is_cancelled'] == 1]

        total = len(bookings)
        total_cancelled = len(cancelled)

        # Analyze patterns
        long_window = len(cancelled[cancelled['days_to_booking'] > 14])
        friday = len(cancelled[cancelled['booking_day_of_week'] == 'Friday'])

        # FIXED: join cancelled leads with call counts by phone_clean
        # then count only those with total_calls_made < 3
        if calls is not None and 'phone_clean' in cancelled.columns and 'to_number_clean' in calls.columns:
            call_counts = calls.groupby('to_number_clean')['from_name'].count().reset_index()
            call_counts.columns = ['phone_clean', '_calls_made']
            cancelled_with_calls = cancelled.merge(call_counts, on='phone_clean', how='left')
            cancelled_with_calls['_calls_made'] = cancelled_with_calls['_calls_made'].fillna(0)
            low_calls = int((cancelled_with_calls['_calls_made'] < 3).sum())
        else:
            # Fallback: cannot determine per-lead call count without calls data
            low_calls = total_cancelled
        
        root_causes = {
            'total_bookings': total,
            'total_cancelled': total_cancelled,
            'cancel_rate_pct': round(total_cancelled / total * 100, 1) if total > 0 else 0,
            'causes': [
                {
                    'cause': 'Long booking windows (>14 days)',
                    'count': long_window,
                    'percentage': round(long_window / total_cancelled * 100, 1) if total_cancelled > 0 else 0,
                    'impact': 'High',
                    'action': 'Encourage 7-14 day booking windows',
                    'active': long_window > 0
                },
                {
                    'cause': 'Insufficient pre-booking contact',
                    'count': low_calls,
                    'percentage': round(low_calls / total_cancelled * 100, 1) if total_cancelled > 0 else 0,
                    'impact': 'High',
                    'action': 'Strengthen confirmation follow-up before booking is confirmed',
                    'active': low_calls > 0
                },
                {
                    'cause': 'Friday appointments',
                    'count': friday,
                    'percentage': round(friday / total_cancelled * 100, 1) if total_cancelled > 0 else 0,
                    'impact': 'Medium',
                    'action': 'Add Friday pre-session confirmation follow-up',
                    'active': friday > 0
                }
            ],
            'action_plan': [
                'Strengthen confirmation follow-up protocol before each booking',
                'Focus on <14 day booking windows',
                'Add Friday pre-session confirmation follow-up'
            ]
        }
        
        logger.info(f"  Root cause analysis complete")
        return root_causes
    
    # ─── V4.1 NEW OUTPUT METHODS ──────────────────────────────────────────────

    def _build_conversion_trends(self, bookings, calls):
        """Week-over-week conversion trends.
        Columns: week_start, bookings_that_week, shows_that_week,
                 booking_rate_pct, show_rate_pct, calls_that_week
        """
        logger.info("\nBuilding conversion trends...")

        bookings_copy = bookings.copy()
        bookings_copy['week_start'] = bookings_copy['booking_date'].dt.to_period('W').dt.start_time

        weekly_bookings = bookings_copy.groupby('week_start').agg(
            bookings_that_week=('booking_id', 'count'),
            shows_that_week=('has_show', 'sum'),
        ).reset_index()

        calls_copy = calls.copy()
        calls_copy['week_start'] = calls_copy['call_start_time'].dt.to_period('W').dt.start_time
        weekly_calls = calls_copy.groupby('week_start').agg(
            calls_that_week=('from_name', 'count'),
        ).reset_index()

        trends = weekly_bookings.merge(weekly_calls, on='week_start', how='outer').fillna(0)
        trends = trends.sort_values('week_start')

        trends['booking_rate_pct'] = np.where(
            trends['calls_that_week'] > 0,
            (trends['bookings_that_week'] / trends['calls_that_week']) * 100,
            0,
        ).round(2)
        trends['show_rate_pct'] = np.where(
            trends['bookings_that_week'] > 0,
            (trends['shows_that_week'] / trends['bookings_that_week']) * 100,
            0,
        ).round(2)

        trends['week_start'] = trends['week_start'].astype(str)
        logger.info(f"  {len(trends)} weeks")
        return trends

    def _build_loyalsnap_engagement(self):
        """Extract Loyalsnap SMS engagement from raw data if available.
        Columns: message_type, sent_count, open_rate, response_rate,
                 opt_out_count, date_sent
        Falls back to empty DataFrame if Loyalsnap sheet not loaded.
        """
        logger.info("\nBuilding Loyalsnap engagement...")

        loyalsnap = self.raw_data.get('loyalsnap')
        if loyalsnap is None or len(loyalsnap) == 0:
            logger.info("  No Loyalsnap sheet found — returning empty DataFrame")
            return pd.DataFrame(columns=[
                'message_type', 'sent_count', 'open_rate',
                'response_rate', 'opt_out_count', 'date_sent',
            ])

        # Flexible column mapping — adjust to actual Loyalsnap export format
        col_map = {
            'Message Type': 'message_type',
            'Sent': 'sent_count',
            'Open Rate': 'open_rate',
            'Response Rate': 'response_rate',
            'Opt Out': 'opt_out_count',
            'Date': 'date_sent',
        }
        df = loyalsnap.rename(columns={k: v for k, v in col_map.items() if k in loyalsnap.columns})

        for col in ['message_type', 'sent_count', 'open_rate', 'response_rate', 'opt_out_count', 'date_sent']:
            if col not in df.columns:
                df[col] = None

        df['date_sent'] = pd.to_datetime(df['date_sent'], errors='coerce').dt.date
        df['sent_count'] = pd.to_numeric(df['sent_count'], errors='coerce').fillna(0)
        df['open_rate'] = pd.to_numeric(df['open_rate'], errors='coerce').fillna(0)
        df['response_rate'] = pd.to_numeric(df['response_rate'], errors='coerce').fillna(0)
        df['opt_out_count'] = pd.to_numeric(df['opt_out_count'], errors='coerce').fillna(0)

        result = df[['message_type', 'sent_count', 'open_rate', 'response_rate', 'opt_out_count', 'date_sent']].copy()
        logger.info(f"  {len(result)} Loyalsnap campaigns")
        return result

    def _build_flexologist_performance(self, bookings):
        """Staff conversion performance by 'Booking With' column.
        Columns: booking_with, total_sessions, shows, cancellations,
                 no_shows, show_rate_pct, cancel_rate_pct
        Admin-only — not exposed in client view.
        """
        logger.info("\nBuilding flexologist performance...")

        if 'Booking With' not in bookings.columns and 'booking_with' not in bookings.columns:
            logger.info("  'Booking With' column not found — returning empty DataFrame")
            return pd.DataFrame(columns=[
                'booking_with', 'total_sessions', 'shows',
                'cancellations', 'no_shows', 'show_rate_pct', 'cancel_rate_pct',
            ])

        col = 'Booking With' if 'Booking With' in bookings.columns else 'booking_with'
        perf = bookings.groupby(col).agg(
            total_sessions=('booking_id', 'count'),
            shows=('has_show', 'sum'),
            cancellations=('is_cancelled', 'sum'),
            no_shows=('is_no_show', 'sum'),
        ).reset_index()
        perf.rename(columns={col: 'booking_with'}, inplace=True)

        perf['show_rate_pct'] = np.where(
            perf['total_sessions'] > 0,
            (perf['shows'] / perf['total_sessions']) * 100,
            0,
        ).round(1)
        perf['cancel_rate_pct'] = np.where(
            perf['total_sessions'] > 0,
            (perf['cancellations'] / perf['total_sessions']) * 100,
            0,
        ).round(1)

        perf = perf[perf['booking_with'].notna() & (perf['booking_with'] != '')]
        perf = perf.sort_values('show_rate_pct', ascending=False)
        logger.info(f"  {len(perf)} flexologists")
        return perf

    def _build_ramp_vs_target(self, bookings, calls):
        """SOW ramp progress vs Month 1/2/3 targets (30/50/77 kept appointments).
        Columns: month, target_kept_appts, actual_kept_appts, pct_of_target, on_track

        Month boundaries are fixed calendar dates from config.SOW_MONTH_BOUNDARIES,
        kept in sync with dashboard/src/utils/config.js CAMPAIGN_MONTHS.
        Uses booking_date with has_show == 1 (already deduped — one row per unique attendee).
        """
        logger.info("\nBuilding ramp vs target...")

        from config import SOW_MONTH_BOUNDARIES

        has_shows = bookings[bookings['has_show'] == 1].copy()

        if has_shows.empty or 'booking_date' not in has_shows.columns:
            return pd.DataFrame([
                {'month': mb['month'], 'target_kept_appts': mb['target'],
                 'actual_kept_appts': 0, 'pct_of_target': 0.0, 'on_track': False}
                for mb in SOW_MONTH_BOUNDARIES
            ])

        has_shows['booking_date_parsed'] = pd.to_datetime(has_shows['booking_date'], errors='coerce')

        def assign_month_fixed(d):
            if pd.isna(d):
                return None  # exclude unparseable dates — do NOT silently bucket to M3
            d = d.date() if hasattr(d, 'date') else d
            for mb in SOW_MONTH_BOUNDARIES:
                if mb['start'] <= d <= mb['end']:
                    return mb['month']
            return None  # outside SOW window

        has_shows['campaign_month'] = has_shows['booking_date_parsed'].apply(assign_month_fixed)

        invalid = has_shows['campaign_month'].isna().sum()
        if invalid:
            logger.warning(f"  {invalid} show(s) have unparseable/out-of-range dates — excluded from ramp")

        monthly = (
            has_shows.dropna(subset=['campaign_month'])
            .groupby('campaign_month').size()
            .reset_index(name='actual_kept_appts')
        )

        rows = []
        for mb in SOW_MONTH_BOUNDARIES:
            month, target = mb['month'], mb['target']
            actual_vals = monthly.loc[monthly['campaign_month'] == month, 'actual_kept_appts'].values
            actual = int(actual_vals[0]) if len(actual_vals) > 0 else 0
            pct = round(actual / target * 100, 1) if target > 0 else 0.0
            rows.append({
                'month': month,
                'target_kept_appts': target,
                'actual_kept_appts': actual,
                'pct_of_target': pct,
                'on_track': actual >= target,
            })

        logger.info(
            f"  Campaign month boundaries: "
            f"M1={SOW_MONTH_BOUNDARIES[0]['start']}–{SOW_MONTH_BOUNDARIES[0]['end']}, "
            f"M2={SOW_MONTH_BOUNDARIES[1]['start']}–{SOW_MONTH_BOUNDARIES[1]['end']}, "
            f"M3={SOW_MONTH_BOUNDARIES[2]['start']}–{SOW_MONTH_BOUNDARIES[2]['end']}"
        )
        logger.info(f"  Ramp: {rows}")
        return pd.DataFrame(rows)

    def _build_velocity_trend(self, lead_funnel, calls):
        """SDR velocity — how many calls per booking, and days from first call to booking.
        Columns: week_start, avg_calls_per_booking, median_days_first_call_to_booking,
                 total_bookings_that_week
        """
        logger.info("\nBuilding velocity trend...")

        if lead_funnel is None or len(lead_funnel) == 0:
            return pd.DataFrame(columns=[
                'week_start', 'avg_calls_per_booking',
                'median_days_first_call_to_booking', 'total_bookings_that_week',
            ])

        funnel = lead_funnel.copy()
        funnel['week_start'] = pd.to_datetime(funnel['booking_date'], errors='coerce').dt.to_period('W').dt.start_time

        velocity = funnel.groupby('week_start').agg(
            avg_calls_per_booking=('total_calls', 'mean'),
            median_days_first_call_to_booking=('days_first_call_to_booking', 'median'),
            total_bookings_that_week=('booking_id', 'count'),
        ).reset_index()

        velocity['avg_calls_per_booking'] = velocity['avg_calls_per_booking'].round(2)
        velocity['median_days_first_call_to_booking'] = velocity['median_days_first_call_to_booking'].round(1)
        velocity['week_start'] = velocity['week_start'].astype(str)
        velocity = velocity.sort_values('week_start')

        logger.info(f"  {len(velocity)} velocity weeks")
        return velocity

    # ─── END V4.1 NEW METHODS ─────────────────────────────────────────────────

    def _build_unattributed_flags(self, calls, bookings, first_visits):
        """
        Find first_visits completions where:
        - Phiwe called that phone number
        - The lead is NOT already in Phiwe's attributed bookings (Tier 1 + Tier 2)

        OUTPUT ONLY — does not affect any booking or show counts.
        For Tamryn to present to Brian at Wednesday meeting.
        """
        import re

        def norm_phone(p):
            if pd.isna(p): return None
            d = re.sub(r'\D', '', str(p))
            return d[-10:] if len(d) >= 10 else None

        if calls.empty or bookings.empty or first_visits.empty:
            return pd.DataFrame()

        # Phones Phiwe called
        calls['_to_norm'] = calls['to_number'].apply(norm_phone)
        called_numbers = set(calls['_to_norm'].dropna())

        # User IDs already attributed to Phiwe
        phiwe_user_ids = set(bookings['user_id'].dropna().astype(int))

        # First visits not already attributed
        fv_complete = first_visits[first_visits['Status'] == 'Complete'].copy()
        fv_not_phiwe = fv_complete[~fv_complete['User ID'].isin(phiwe_user_ids)].copy()

        # Normalize first_visits phone
        fv_not_phiwe['_cell_norm'] = fv_not_phiwe['Cellphone'].apply(norm_phone)

        # Find matches
        flags = fv_not_phiwe[fv_not_phiwe['_cell_norm'].isin(called_numbers)].copy()

        if len(flags) == 0:
            return pd.DataFrame()

        # Build output
        result = pd.DataFrame({
            'user_id':          flags['User ID'].values,
            'first_name':       flags['First Name'].values,
            'last_name':        flags['Last Name'].values,
            'location':         flags['Location Name'].values,
            'first_visit_date': flags['Booking Date'].values,
            'cellphone':        flags['Cellphone'].values,
            'flag_reason':      'Phiwe called this number; lead completed first visit under different booking attribution',
            'confidence':       'Medium',
        })

        # Elevate Timothy Cooper — also in manual tracker
        timothy_mask = (result['first_name'] == 'Timothy') & (result['last_name'] == 'Cooper')
        result.loc[timothy_mask, 'confidence'] = 'High - also in manual tracker (Paid=Yes)'

        return result.reset_index(drop=True)

    def _build_validation(self, bookings, manual_tracker_path):
        """Build validation outputs"""
        logger.info("\nBuilding validation...")
        
        import json
        from pathlib import Path
        import pandas as pd
        
        # Load manual tracker
        manual_path = Path(manual_tracker_path)
        if not manual_path.exists():
            logger.warning(f"  Manual tracker not found: {manual_path}")
            return {}
        
        m1 = pd.read_excel(manual_path, sheet_name='Phiwe Calls - Appointments Book')
        m2 = pd.read_excel(manual_path, sheet_name='Sheet2')
        # Strip trailing/leading whitespace from column names (workbook headers have inconsistent spacing)
        m1.columns = m1.columns.str.strip()
        m2.columns = m2.columns.str.strip()

        manual_total = len(m1) + len(m2)
        system_total = len(bookings)
        
        drift_pct = ((system_total - manual_total) / manual_total * 100) if manual_total > 0 else 0
        gap_count = manual_total - system_total
        
        # Validation report
        validation_report = {
            'generated_at': datetime.now().isoformat(),
            'system_metrics': {
                'total_bookings': system_total,
                'shows': int(bookings['has_show'].sum()),
                'cancellations': int(bookings['is_cancelled'].sum()),
                'no_shows': int(bookings['is_no_show'].sum())
            },
            'manual_metrics': {
                'total_bookings': manual_total,
                'month_1': len(m1),
                'month_2': len(m2)
            },
            'drift': {
                'booking_drift_pct': round(drift_pct, 1),
                'gap_bookings': gap_count,
                'gap_direction': 'manual_has_more' if gap_count > 0 else 'system_has_more'
            },
            'status': 'expected' if gap_count >= 0 else 'investigate'
        }
        
        # Per-record gap: match manual tracker names to system bookings
        m1['_month'] = 1
        m2['_month'] = 2
        for col in ['Status', 'Held', 'Notes']:
            if col not in m1.columns: m1[col] = pd.NA
            if col not in m2.columns: m2[col] = pd.NA
        combined = pd.concat([m1, m2], ignore_index=True)
        system_names = set(bookings['full_name_lower'].dropna())
        combined['_norm'] = combined['Name'].apply(_norm_name)
        def _clean_appt_date(val):
            """Parse messy manual-tracker date cells to ISO format; return None if blank."""
            if val is None or (isinstance(val, float) and pd.isna(val)):
                return None
            s = str(val).strip()
            if not s or s.lower() in ('nan', 'none', 'nat'):
                return None
            # Try standard pandas parse first
            parsed = pd.to_datetime(s, errors='coerce')
            if parsed is not pd.NaT and not pd.isna(parsed) and 2024 <= parsed.year <= 2030:
                return parsed.strftime('%Y-%m-%d %H:%M:%S')
            # Fall back to dateutil fuzzy parse (handles "Friday, April 17," and extra text).
            # dateutil fills missing year from today — correct for current campaign dates.
            try:
                from dateutil import parser as du_parser
                parsed2 = du_parser.parse(s, fuzzy=True)
                if 2024 <= parsed2.year <= 2030:
                    return parsed2.strftime('%Y-%m-%d %H:%M:%S')
            except Exception:
                pass
            return None

        gap_details = pd.DataFrame({
            'name':                combined['Name'],
            'date_of_appointment': combined['Date of appointment'].apply(_clean_appt_date),
            'location':            combined['Location'],
            'paid':                combined['Paid?'],
            'in_system':           combined['_norm'].isin(system_names),
            'month':               combined['_month'],
            'notes':               combined['Notes'],
            'lead_age':            combined.get('Lead Age', pd.Series([None] * len(combined))),
            'prior_visits':        combined.get('Number of Prior Visits', pd.Series([None] * len(combined))),
            'held':                combined.get('Held', pd.Series([None] * len(combined))),
        })

        unmatched = int((~gap_details['in_system']).sum())
        logger.info(f"  Validation complete")
        logger.info(f"    System: {system_total} bookings")
        logger.info(f"    Manual: {manual_total} bookings")
        logger.info(f"    Gap: {gap_count} bookings (manual has more)")
        logger.info(f"    Unmatched in system: {unmatched} manual tracker entries")

        # Build show_gaps: held=Yes in tracker but no confirmed show in pipeline
        held_mask = combined['Held'].astype(str).str.strip().str.lower() == 'yes'
        held_rows = combined[held_mask]
        confirmed_norms = set(
            n for n in (
                _norm_name(v) for v in
                bookings.loc[bookings['has_show'] == 1, 'full_name_lower'].dropna()
            )
            if n
        )
        show_gap_leads = []
        for _, row in held_rows.iterrows():
            norm = _norm_name(row.get('Name'))
            if norm not in confirmed_norms:
                show_gap_leads.append({
                    'name':     str(row.get('Name', '')).strip(),
                    'date':     str(row.get('Date of appointment', '')).strip(),
                    'location': str(row.get('Location', '')).strip(),
                    'notes':    str(row.get('Notes', '')).strip(),
                })
        validation_report['show_gaps'] = {
            'tracker_held_count': int(held_mask.sum()),
            'pipeline_shows':     int(bookings['has_show'].sum()),
            'gap_count':          len(show_gap_leads),
            'gap_leads':          show_gap_leads,
            'note': (
                'Leads recorded as held in the manual tracker with no confirmed '
                'attendance in ClubReady. Studio must update ClubReady records '
                'before these sessions can be counted in pipeline metrics.'
            ),
        }
        logger.info(f"    Show gaps: {len(show_gap_leads)} (held in tracker, not in pipeline)")

        return {
            'validation_report': validation_report,
            'validation_lead_details': gap_details
        }


if __name__ == '__main__':
    print("Transform module loaded")
