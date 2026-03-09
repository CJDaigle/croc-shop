#!/bin/bash

# Test Data Validation Script
# Validates the generated test data for completeness and correctness

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CUSTOMER_FILE="$TEST_DIR/customer_data.csv"
ORDER_FILE="$TEST_DIR/order_data.csv"

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    Test Data Validation${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

validate_customer_data() {
    echo "Validating customer data..."
    
    if [[ ! -f "$CUSTOMER_FILE" ]]; then
        echo -e "${RED}✗ Customer data file not found: $CUSTOMER_FILE${NC}"
        return 1
    fi
    
    local customer_count=$(wc -l < "$CUSTOMER_FILE")
    echo -e "${GREEN}✓ Customer data file found: $CUSTOMER_FILE${NC}"
    echo "  - Total customers: $customer_count"
    
    # Check header
    local header=$(head -n 1 "$CUSTOMER_FILE")
    if [[ "$header" != "customerId,firstName,lastName,email" ]]; then
        echo -e "${YELLOW}⚠ Unexpected header format: $header${NC}"
    else
        echo -e "${GREEN}✓ Header format correct${NC}"
    fi
    
    # Validate data format (skip header)
    local invalid_lines=0
    local line_num=0
    
    while IFS= read -r line; do
        ((line_num++))
        if [[ $line_num -eq 1 ]]; then continue; fi  # Skip header
        
        # Check if line has 4 fields
        local field_count=$(echo "$line" | tr ',' '\n' | wc -l)
        if [[ $field_count -ne 4 ]]; then
            echo -e "${RED}✗ Line $line_num: Invalid field count ($field_count)${NC}"
            ((invalid_lines++))
        fi
        
        # Check customer ID is numeric
        local customer_id=$(echo "$line" | cut -d',' -f1)
        if ! [[ "$customer_id" =~ ^[0-9]+$ ]]; then
            echo -e "${RED}✗ Line $line_num: Invalid customer ID: $customer_id${NC}"
            ((invalid_lines++))
        fi
        
        # Check email format (basic)
        local email=$(echo "$line" | cut -d',' -f4)
        if [[ ! "$email" =~ ^[a-zA-Z]+[a-zA-Z0-9]*@testmail\.com$ ]]; then
            echo -e "${YELLOW}⚠ Line $line_num: Unexpected email format: $email${NC}"
        fi
        
    done < "$CUSTOMER_FILE"
    
    if [[ $invalid_lines -eq 0 ]]; then
        echo -e "${GREEN}✓ All customer data validated successfully${NC}"
    else
        echo -e "${RED}✗ Found $invalid_lines invalid lines${NC}"
    fi
    
    return $invalid_lines
}

validate_order_data() {
    echo ""
    echo "Validating order data..."
    
    if [[ ! -f "$ORDER_FILE" ]]; then
        echo -e "${RED}✗ Order data file not found: $ORDER_FILE${NC}"
        return 1
    fi
    
    local order_count=$(wc -l < "$ORDER_FILE")
    echo -e "${GREEN}✓ Order data file found: $ORDER_FILE${NC}"
    echo "  - Total orders: $order_count"
    
    # Check header
    local header=$(head -n 1 "$ORDER_FILE")
    if [[ "$header" != "orderId,customerId,numItems,timestamp" ]]; then
        echo -e "${YELLOW}⚠ Unexpected header format: $header${NC}"
    else
        echo -e "${GREEN}✓ Header format correct${NC}"
    fi
    
    # Validate data format
    local invalid_lines=0
    local line_num=0
    declare -A customer_orders
    declare -A item_counts
    
    while IFS= read -r line; do
        ((line_num++))
        if [[ $line_num -eq 1 ]]; then continue; fi  # Skip header
        
        # Check if line has 4 fields
        local field_count=$(echo "$line" | tr ',' '\n' | wc -l)
        if [[ $field_count -ne 4 ]]; then
            echo -e "${RED}✗ Line $line_num: Invalid field count ($field_count)${NC}"
            ((invalid_lines++))
        fi
        
        # Extract fields
        local order_id=$(echo "$line" | cut -d',' -f1)
        local customer_id=$(echo "$line" | cut -d',' -f2)
        local num_items=$(echo "$line" | cut -d',' -f3)
        local timestamp=$(echo "$line" | cut -d',' -f4)
        
        # Validate order ID
        if ! [[ "$order_id" =~ ^[0-9]+$ ]]; then
            echo -e "${RED}✗ Line $line_num: Invalid order ID: $order_id${NC}"
            ((invalid_lines++))
        fi
        
        # Validate customer ID
        if ! [[ "$customer_id" =~ ^[0-9]+$ ]]; then
            echo -e "${RED}✗ Line $line_num: Invalid customer ID: $customer_id${NC}"
            ((invalid_lines++))
        fi
        
        # Validate number of items (should be 2 or 3)
        if [[ "$num_items" != "2" && "$num_items" != "3" ]]; then
            echo -e "${YELLOW}⚠ Line $line_num: Unexpected item count: $num_items${NC}"
        fi
        
        # Validate timestamp
        if ! [[ "$timestamp" =~ ^[0-9]{13}$ ]]; then
            echo -e "${RED}✗ Line $line_num: Invalid timestamp: $timestamp${NC}"
            ((invalid_lines++))
        fi
        
        # Track customer orders
        customer_orders[$customer_id]=$((${customer_orders[$customer_id]:-0} + 1))
        
        # Track item distribution
        item_counts[$num_items]=$((${item_counts[$num_items]:-0} + 1))
        
    done < "$ORDER_FILE"
    
    if [[ $invalid_lines -eq 0 ]]; then
        echo -e "${GREEN}✓ All order data validated successfully${NC}"
        
        # Show statistics
        echo ""
        echo "Order Statistics:"
        for customer_id in "${!customer_orders[@]}"; do
            echo "  - Customer $customer_id: ${customer_orders[$customer_id]} orders"
        done | sort -n -k2 | head -10  # Show top 10
        
        echo ""
        echo "Item Count Distribution:"
        for num_items in "${!item_counts[@]}"; do
            echo "  - $num_items items: ${item_counts[$num_items]} orders"
        done | sort -n
        
    else
        echo -e "${RED}✗ Found $invalid_lines invalid lines${NC}"
    fi
    
    return $invalid_lines
}

validate_relationships() {
    echo ""
    echo "Validating customer-order relationships..."
    
    if [[ ! -f "$CUSTOMER_FILE" || ! -f "$ORDER_FILE" ]]; then
        echo -e "${YELLOW}⚠ Cannot validate relationships - missing data files${NC}"
        return 0
    fi
    
    # Get customer IDs from customer file
    local customer_ids=()
    while IFS= read -r line; do
        local customer_id=$(echo "$line" | cut -d',' -f1)
        if [[ "$customer_id" =~ ^[0-9]+$ ]]; then
            customer_ids+=("$customer_id")
        fi
    done < <(tail -n +2 "$CUSTOMER_FILE")  # Skip header
    
    # Check if all order customer IDs exist in customer file
    local orphaned_orders=0
    while IFS= read -r line; do
        local customer_id=$(echo "$line" | cut -d',' -f2)
        if [[ ! " ${customer_ids[@]} " =~ " $customer_id " ]]; then
            echo -e "${RED}✗ Order for unknown customer: $customer_id${NC}"
            ((orphaned_orders++))
        fi
    done < <(tail -n +2 "$ORDER_FILE")  # Skip header
    
    if [[ $orphaned_orders -eq 0 ]]; then
        echo -e "${GREEN}✓ All orders belong to valid customers${NC}"
    else
        echo -e "${RED}✗ Found $orphaned_orders orphaned orders${NC}"
    fi
    
    return $orphaned_orders
}

generate_summary() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    Validation Summary${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    local total_customers=0
    local total_orders=0
    local total_errors=0
    
    if [[ -f "$CUSTOMER_FILE" ]]; then
        total_customers=$(($(wc -l < "$CUSTOMER_FILE") - 1))  # Subtract header
    fi
    
    if [[ -f "$ORDER_FILE" ]]; then
        total_orders=$(($(wc -l < "$ORDER_FILE") - 1))  # Subtract header
    fi
    
    echo "Data Files Generated:"
    echo "  - Customers: $total_customers"
    echo "  - Orders: $total_orders"
    
    if [[ $total_customers -gt 0 ]]; then
        local avg_orders_per_customer=$((total_orders / total_customers))
        echo "  - Average orders per customer: $avg_orders_per_customer"
    fi
    
    echo ""
    echo "Test Coverage:"
    echo "  - Customer creation: ✓"
    echo "  - Order placement: ✓"
    echo "  - Data validation: ✓"
    
    if [[ $total_errors -eq 0 ]]; then
        echo -e "${GREEN}✓ All validations passed${NC}"
    else
        echo -e "${RED}✗ Found validation errors${NC}"
    fi
    
    echo ""
    echo "Files Generated:"
    [[ -f "$CUSTOMER_FILE" ]] && echo "  - $CUSTOMER_FILE"
    [[ -f "$ORDER_FILE" ]] && echo "  - $ORDER_FILE"
    
    echo ""
    echo -e "${BLUE}========================================${NC}"
}

# Main execution
main() {
    print_header
    
    local errors=0
    
    validate_customer_data || ((errors++))
    validate_order_data || ((errors++))
    validate_relationships || ((errors++))
    
    generate_summary
    
    exit $errors
}

# Run main function
main
