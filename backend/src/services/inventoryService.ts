/**
 * Smart Inventory Prediction Service
 * Calculates stock depletion rates, predicts remaining operational days, and triggers low-stock alerts.
 */

export interface InventoryPrediction {
  medicineId: string;
  medicineName: string;
  currentQuantity: number;
  dailyAvgUsage: number;
  estimatedRemainingDays: number;
  urgency: 'normal' | 'warning' | 'critical';
  recommendation: string;
}

export const predictInventoryStatus = (
  medicineId: string,
  medicineName: string,
  currentQuantity: number,
  minStockLevel: number,
  dailyAvgUsage: number = 5
): InventoryPrediction => {
  const usage = dailyAvgUsage > 0 ? dailyAvgUsage : 1;
  const remainingDays = Math.floor(currentQuantity / usage);

  let urgency: 'normal' | 'warning' | 'critical' = 'normal';
  let recommendation = 'Stock levels healthy.';

  if (currentQuantity === 0) {
    urgency = 'critical';
    recommendation = 'OUT OF STOCK: Immediate reorder required to prevent prescription fulfillment delays.';
  } else if (remainingDays <= 3 || currentQuantity <= minStockLevel) {
    urgency = 'critical';
    recommendation = `Critical: Stock may run out in approximately ${remainingDays} days. Urgent reorder recommended.`;
  } else if (remainingDays <= 7) {
    urgency = 'warning';
    recommendation = `Warning: Stock will drop below minimum threshold in ~${remainingDays} days. Plan procurement.`;
  }

  return {
    medicineId,
    medicineName,
    currentQuantity,
    dailyAvgUsage: usage,
    estimatedRemainingDays: remainingDays,
    urgency,
    recommendation
  };
};
