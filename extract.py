"""
StretchLab B2C Pipeline - Extract Module (V4.0 FINAL)
Extracts data from Excel workbook (all sheets)
"""

import pandas as pd
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class DataExtractor:
    """
    V4.0: Extract data from StretchLab workbook
    NO PHONE MATCHING - Direct + Tamryn only
    """
    
    def __init__(self, workbook_path):
        self.workbook_path = Path(workbook_path)
        
    def extract(self):
        """Extract all data from workbook"""
        logger.info(f"Extracting data from: {self.workbook_path}")
        
        if not self.workbook_path.exists():
            raise FileNotFoundError(f"Workbook not found: {self.workbook_path}")
        
        # Load all sheets
        xl = pd.ExcelFile(self.workbook_path)
        logger.info(f"Found {len(xl.sheet_names)} sheets: {xl.sheet_names}")
        
        # Extract each sheet
        data = {
            'calls': self._extract_calls(xl),
            'bookings': self._extract_bookings(xl),
            'first_visits': self._extract_first_visits(xl),
            'loyalsnap': self._extract_loyalsnap(xl)
        }
        
        logger.info("✅ Extraction complete")
        return data
    
    def _extract_calls(self, xl):
        """Extract RingCentral call log"""
        logger.info("Extracting calls...")
        
        calls = pd.read_excel(xl, sheet_name='ringcentral_call_log')
        
        # Rename columns for consistency
        calls = calls.rename(columns={
            'From Name': 'from_name',
            'From Number': 'from_number',
            'To Name': 'to_name',
            'To Number': 'to_number',
            'Date-Time': 'call_start_time',
            'Length': 'call_length',
            'Direction': 'call_direction',
            'Call Type': 'call_type',
            'Call Response': 'call_response',
            'Result': 'result',
            'Ringing': 'ringing_time',
            'Live Talk': 'live_talk_time'
        })
        
        logger.info(f"  Extracted {len(calls):,} call records")
        return calls
    
    def _extract_bookings(self, xl):
        """Extract booking events log, falling back to the most recent previous workbook if empty."""
        logger.info("Extracting bookings...")

        bookings = pd.read_excel(xl, sheet_name='booking_events_log')

        if len(bookings) == 0:
            logger.warning("  booking_events_log is empty — searching previous workbooks for booking data...")
            import re
            raw_dir = self.workbook_path.parent
            current_name = self.workbook_path.name
            date_pat = re.compile(r'(\d{4}-\d{2}-\d{2})')
            cur_match = date_pat.search(current_name)
            cur_date = cur_match.group(1) if cur_match else ''

            candidates = sorted([
                f for f in raw_dir.glob('Stretchlab_B2C_DB_Phiwe_*.xlsx')
                if f.name != current_name
            ], reverse=True)

            for candidate in candidates:
                try:
                    prev = pd.read_excel(candidate, sheet_name='booking_events_log')
                    if len(prev) > 0:
                        logger.warning(f"  Falling back to {candidate.name} ({len(prev):,} booking events)")
                        bookings = prev
                        break
                except Exception:
                    continue

            if len(bookings) == 0:
                logger.error("  No booking data found in any workbook — pipeline will be incomplete")

        logger.info(f"  Extracted {len(bookings):,} booking events")
        return bookings
    
    def _extract_first_visits(self, xl):
        """Extract first visits"""
        logger.info("Extracting first visits...")

        first_visits = pd.read_excel(xl, sheet_name='first_visits')
        # Normalize column names: some exports use newlines instead of spaces
        first_visits.columns = first_visits.columns.str.replace('\n', ' ', regex=False)

        logger.info(f"  Extracted {len(first_visits):,} first visit records")
        return first_visits
    
    def _extract_loyalsnap(self, xl):
        """Extract LoyalSnap activity"""
        logger.info("Extracting LoyalSnap...")
        
        loyalsnap = pd.read_excel(xl, sheet_name='loyalsnap')
        
        logger.info(f"  Extracted {len(loyalsnap):,} LoyalSnap records")
        return loyalsnap


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python extract.py <workbook_path>")
        sys.exit(1)
    
    extractor = DataExtractor(sys.argv[1])
    data = extractor.extract()
    
    print("\n" + "="*70)
    print("EXTRACTION SUMMARY")
    print("="*70)
    for key, df in data.items():
        print(f"{key}: {len(df):,} rows")
