"""
Data Loading Module
Loads transformed data to Google Sheets
"""

import logging
import pandas as pd

logger = logging.getLogger(__name__)


class DataLoader:
    """Load data to Google Sheets"""
    
    def __init__(self, config):
        self.config = config
        self.sheets_id = config.google_sheets_id
        self.credentials_path = config.google_credentials_path
    
    def load(self, transformed_data):
        """
        Load all tables to Google Sheets
        
        Args:
            transformed_data: dict of DataFrames to load
        """
        logger.info("Loading data to Google Sheets...")
        
        if not self.sheets_id:
            logger.warning("Google Sheets ID not configured. Exporting to CSV instead.")
            self._export_to_csv(transformed_data)
            return
        
        try:
            # Import gspread (Google Sheets API)
            import gspread
            from oauth2client.service_account import ServiceAccountCredentials
            
            # Setup credentials
            scope = ['https://spreadsheets.google.com/feeds',
                     'https://www.googleapis.com/auth/drive']
            
            creds = ServiceAccountCredentials.from_json_keyfile_name(
                self.credentials_path, scope
            )
            client = gspread.authorize(creds)
            
            # Open the spreadsheet
            spreadsheet = client.open_by_key(self.sheets_id)
            
            # Load each table
            for table_name, df in transformed_data.items():
                self._load_table(spreadsheet, table_name, df)
            
            logger.info("✓ All tables loaded to Google Sheets")
            
        except ImportError:
            logger.error("gspread not installed. Run: pip install gspread oauth2client")
            self._export_to_csv(transformed_data)
            
        except Exception as e:
            logger.error(f"Failed to load to Google Sheets: {e}")
            logger.info("Exporting to CSV as fallback")
            self._export_to_csv(transformed_data)
    
    def _load_table(self, spreadsheet, table_name, df):
        """Load a single table to Google Sheets"""
        logger.info(f"  Loading {table_name}...")
        
        try:
            # Try to get existing worksheet
            try:
                worksheet = spreadsheet.worksheet(table_name)
                # Clear existing data
                worksheet.clear()
            except:
                # Create new worksheet
                worksheet = spreadsheet.add_worksheet(
                    title=table_name,
                    rows=len(df) + 1,
                    cols=len(df.columns)
                )
            
            # Convert DataFrame to list of lists
            # Handle date/datetime columns
            df_export = df.copy()
            for col in df_export.columns:
                if df_export[col].dtype == 'object':
                    df_export[col] = df_export[col].astype(str)
                elif 'datetime' in str(df_export[col].dtype):
                    df_export[col] = df_export[col].astype(str)
            
            # Prepare data with headers
            data = [df_export.columns.tolist()] + df_export.values.tolist()
            
            # Update worksheet
            worksheet.update(data, value_input_option='USER_ENTERED')
            
            logger.info(f"    ✓ Loaded {len(df):,} rows to {table_name}")
            
        except Exception as e:
            logger.error(f"    ✗ Failed to load {table_name}: {e}")
            raise
    
    def _export_to_csv(self, transformed_data):
        """Export tables to CSV as fallback"""
        output_dir = self.config.project_root / 'output'
        output_dir.mkdir(exist_ok=True)
        
        for table_name, df in transformed_data.items():
            csv_path = output_dir / f'{table_name}.csv'
            df.to_csv(csv_path, index=False)
            logger.info(f"  ✓ Exported {table_name} to {csv_path}")
