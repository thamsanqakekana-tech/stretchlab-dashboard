"""
Data Validation Module
Validates data quality and compares against manual tracker
"""

import pandas as pd
import logging

logger = logging.getLogger(__name__)


class DataValidator:
    """Validate data quality and completeness"""
    
    def __init__(self, config):
        self.config = config
        self.manual_tracker_path = config.manual_tracker_path
    
    def validate(self, raw_data, transformed_data):
        """
        Run validation checks
        
        Returns:
            dict: {
                'critical_errors': [],
                'warnings': [],
                'validation_report': DataFrame
            }
        """
        logger.info("Running validation checks...")
        
        critical_errors = []
        warnings = []
        validation_metrics = {}
        
        # Validate transformed data quality
        for table_name, df in transformed_data.items():
            if df.empty:
                warnings.append(f"Table '{table_name}' is empty")
                continue
            
            # Check for nulls in critical columns
            if table_name == self.config.output_tables['lead_funnel']:
                null_user_ids = df['user_id'].isna().sum()
                if null_user_ids > 0:
                    warnings.append(f"{null_user_ids} leads missing User ID in funnel")
            
            if table_name == self.config.output_tables['daily_performance']:
                null_dates = df['date'].isna().sum()
                if null_dates > 0:
                    critical_errors.append(f"{null_dates} rows missing dates in daily performance")
        
        # Validate against manual tracker if available
        if self.manual_tracker_path and self.manual_tracker_path.exists():
            tracker_validation = self._validate_against_tracker(
                raw_data,
                transformed_data
            )
            warnings.extend(tracker_validation['warnings'])
            validation_metrics.update(tracker_validation['metrics'])
        else:
            logger.info("  Manual tracker not found - skipping validation")
        
        # Log validation summary
        logger.info("\n  Validation Summary:")
        for metric_name, metric_value in validation_metrics.items():
            logger.info(f"    - {metric_name}: {metric_value}")
        
        if not critical_errors and not warnings:
            logger.info("  ✓ All validation checks passed")
        
        return {
            'critical_errors': critical_errors,
            'warnings': warnings,
            'validation_metrics': validation_metrics
        }
    
    def _validate_against_tracker(self, raw_data, transformed_data):
        """Compare system data against manual tracker"""
        logger.info("  Validating against manual tracker...")
        
        warnings = []
        metrics = {}
        
        try:
            # Load manual tracker sheets
            manual_calls = self._load_manual_calls()
            manual_appointments = self._load_manual_appointments()
            
            if manual_calls is not None and not manual_calls.empty:
                # Count manual calls
                manual_call_count = len(manual_calls)
                
                # Count system calls
                system_calls = raw_data.get('ringcentral_call_log', pd.DataFrame())
                
                # Filter to Phiwe
                phiwe_system_calls = system_calls[
                    system_calls['From Name'].isin(self.config.phiwe_name_variations)
                ].copy()
                
                system_call_count = len(phiwe_system_calls[
                    phiwe_system_calls['Call Direction'] == 'Outbound'
                ])
                
                metrics['System Calls (Outbound)'] = system_call_count
                metrics['Manual Tracker Calls'] = manual_call_count
                
                # Flag if significant discrepancy
                diff = abs(system_call_count - manual_call_count)
                diff_pct = (diff / manual_call_count * 100) if manual_call_count > 0 else 0
                
                if diff_pct > 10:
                    warnings.append(
                        f"Call count discrepancy: System={system_call_count}, "
                        f"Manual={manual_call_count} ({diff_pct:.1f}% difference)"
                    )
            
            if manual_appointments is not None and not manual_appointments.empty:
                # Count manual bookings
                manual_booking_count = len(manual_appointments)
                
                # Count system bookings
                system_bookings = raw_data.get('booking_events_log', pd.DataFrame())
                
                # Filter and deduplicate
                phiwe_mask = (
                    system_bookings['Booking Made By'].isin(self.config.phiwe_name_variations) |
                    system_bookings['Event Logged By'].isin(self.config.phiwe_name_variations)
                )
                
                phiwe_bookings = system_bookings[phiwe_mask].copy()
                
                # Deduplicate
                unique_booking_ids = phiwe_bookings['Booking ID'].nunique()
                
                metrics['System Bookings'] = unique_booking_ids
                metrics['Manual Tracker Bookings'] = manual_booking_count
                
                # Calculate gap
                gap = manual_booking_count - unique_booking_ids
                gap_pct = (gap / manual_booking_count * 100) if manual_booking_count > 0 else 0
                
                metrics['Attribution Gap'] = gap
                metrics['Attribution Gap %'] = f"{gap_pct:.1f}%"
                
                if gap > 0:
                    warnings.append(
                        f"Attribution gap detected: {gap} bookings "
                        f"({gap_pct:.1f}%) in manual tracker not found in system"
                    )
            
        except Exception as e:
            logger.warning(f"  Could not validate against tracker: {e}")
        
        return {
            'warnings': warnings,
            'metrics': metrics
        }
    
    def _load_manual_calls(self):
        """Load manual call tracking sheets"""
        try:
            # Try to load Month 1 and Month 2 sheets
            calls_m1 = pd.read_excel(
                self.manual_tracker_path,
                sheet_name='Phiwe Calls - Month 1 - Daily C'
            )
            
            try:
                calls_m2 = pd.read_excel(
                    self.manual_tracker_path,
                    sheet_name='Phiwe Calls - Month 2 - Daily C'
                )
                return pd.concat([calls_m1, calls_m2], ignore_index=True)
            except:
                return calls_m1
                
        except Exception as e:
            logger.warning(f"Could not load manual calls: {e}")
            return None
    
    def _load_manual_appointments(self):
        """Load manual appointment tracking"""
        try:
            return pd.read_excel(
                self.manual_tracker_path,
                sheet_name='Phiwe Calls - Appointments Book'
            )
        except Exception as e:
            logger.warning(f"Could not load manual appointments: {e}")
            return None
