-- =====================================================================
-- PRACTICE1 - SQL practice on the COM sample data (Milestone 2, Day 13)
-- Author: Arnav    Created: 2026-10-06
--
-- Not run automatically. Paste one query at a time into STRSQL, or run
-- it from Code for IBM i (SQL editor). Try writing each query yourself
-- from the question first, then compare. Expected results assume a fresh
-- CALL COM022LIB/LOADDATA.
--
-- Change log:
--   2026-10-06  Arnav  Created (Sprint 1, checkpoint 1C)
-- =====================================================================

-- Q1. Active customers, sorted by name.                 (WHERE, ORDER BY)
-- Expect 4 rows: ABC INDUSTRIES, GUPTA ELECTRONICS, SAI ENTERPRISES,
--                SHARMA TRADERS
SELECT CUSTNO, CUSTNAME, CITY
  FROM COM022LIB.CSTMST
 WHERE STATUS = 'A'
 ORDER BY CUSTNAME;

-- Q2. Items with stock below 5.
-- Expect 3 rows: 5004 (4), 5005 (0), 5008 (3)
SELECT ITEMNO, ITEMDESC, STOCKQTY
  FROM COM022LIB.ITMMST
 WHERE STOCKQTY < 5
 ORDER BY ITEMNO;

-- Q3. Items priced between 500 and 2000.                       (BETWEEN)
-- Expect 3 rows: 5002 (650.00), 5003 (1200.00), 5008 (1800.00)
SELECT ITEMNO, ITEMDESC, UNITPRICE
  FROM COM022LIB.ITMMST
 WHERE UNITPRICE BETWEEN 500 AND 2000
 ORDER BY UNITPRICE;

-- Q4. Customers whose name contains TRADERS.                      (LIKE)
-- Expect 1 row: 2002 SHARMA TRADERS
SELECT CUSTNO, CUSTNAME
  FROM COM022LIB.CSTMST
 WHERE CUSTNAME LIKE '%TRADERS%';

-- Q5. Lines of order 10002 with the customer name.        (3-table JOIN)
-- Expect 4 rows, all SHARMA TRADERS: lines 1-4 = 5004, 5006, 5002, 5008
SELECT d.ORDNO, d.LINENO, d.ITEMNO, d.ITEMDESC, d.QTY, d.AMOUNT,
       c.CUSTNAME
  FROM COM022LIB.ORDDTL d
  JOIN COM022LIB.ORDHDR h ON h.ORDNO  = d.ORDNO
  JOIN COM022LIB.CSTMST c ON c.CUSTNO = h.CUSTNO
 WHERE d.ORDNO = 10002
 ORDER BY d.LINENO;

-- Q6. Total value of all orders.                                   (SUM)
-- Expect 124750.00  (10001 = 96850.00, 10002 = 27900.00)
SELECT SUM(TOTAMT) AS TOTAL_VALUE
  FROM COM022LIB.ORDHDR;

-- Q7. Order value per item category.              (JOIN + GROUP BY)
-- Expect 4 rows: COMPUTERS 90000.00, DISPLAYS 19000.00,
--                ACCESSORIES 11250.00, STORAGE 4500.00
SELECT i.CATEGORY, SUM(d.AMOUNT) AS VALUE
  FROM COM022LIB.ORDDTL d
  JOIN COM022LIB.ITMMST i ON i.ITEMNO = d.ITEMNO
 GROUP BY i.CATEGORY
 ORDER BY VALUE DESC;

-- Q8. Items ordered more than 3 units in total.                 (HAVING)
-- Expect 2 rows: 5006 (10), 5002 (9)
SELECT d.ITEMNO, i.ITEMDESC, SUM(d.QTY) AS TOTAL_QTY
  FROM COM022LIB.ORDDTL d
  JOIN COM022LIB.ITMMST i ON i.ITEMNO = d.ITEMNO
 GROUP BY d.ITEMNO, i.ITEMDESC
HAVING SUM(d.QTY) > 3
 ORDER BY TOTAL_QTY DESC;

-- Q9. Customers who have never ordered.                     (NOT EXISTS)
-- Expect 3 rows: 2003, 2004, 2005
SELECT c.CUSTNO, c.CUSTNAME
  FROM COM022LIB.CSTMST c
 WHERE NOT EXISTS (SELECT 1 FROM COM022LIB.ORDHDR h
                    WHERE h.CUSTNO = c.CUSTNO)
 ORDER BY c.CUSTNO;

-- Q10. Every customer with their number of orders.     (LEFT JOIN, COUNT)
-- Expect 5 rows: 2001 1, 2002 1, 2003 0, 2004 0, 2005 0
-- (COUNT(h.ORDNO) not COUNT(*): COUNT(*) would give 1 for no orders.)
SELECT c.CUSTNO, c.CUSTNAME, COUNT(h.ORDNO) AS ORDERS
  FROM COM022LIB.CSTMST c
  LEFT JOIN COM022LIB.ORDHDR h ON h.CUSTNO = c.CUSTNO
 GROUP BY c.CUSTNO, c.CUSTNAME
 ORDER BY c.CUSTNO;

-- Q11. Stock status label per item.                                (CASE)
-- Expect: 5005 OUT; 5004, 5008 LOW; the other 5 OK
SELECT ITEMNO, ITEMDESC, STOCKQTY,
       CASE WHEN STOCKQTY = 0 THEN 'OUT'
            WHEN STOCKQTY <= 5 THEN 'LOW'
            ELSE 'OK'
       END AS STOCK_STATUS
  FROM COM022LIB.ITMMST
 ORDER BY ITEMNO;

-- Q12. Day of the week of each order, and days since the first order.
--                                                     (date functions)
-- Expect: 10001 Monday 0, 10002 Thursday 3
SELECT ORDNO, ORDDATE, DAYNAME(ORDDATE) AS WEEKDAY,
       DAYS(ORDDATE) - (SELECT MIN(DAYS(ORDDATE))
                          FROM COM022LIB.ORDHDR) AS DAYS_AFTER_FIRST
  FROM COM022LIB.ORDHDR
 ORDER BY ORDNO;

-- Q13. Biggest and smallest order line.                       (MAX, MIN)
-- Expect: MAX 90000.00 (10001 line 1), MIN 1800.00 (10002 line 4)
SELECT MAX(AMOUNT) AS BIGGEST, MIN(AMOUNT) AS SMALLEST
  FROM COM022LIB.ORDDTL;

-- Q14. Items priced above the average item price.      (scalar subquery)
-- Average of the 8 prices = 73100.00 / 8 = 9137.50
-- Expect 3 rows: 5001 (45000.00), 5005 (12000.00), 5004 (9500.00)
SELECT ITEMNO, ITEMDESC, UNITPRICE
  FROM COM022LIB.ITMMST
 WHERE UNITPRICE > (SELECT AVG(UNITPRICE) FROM COM022LIB.ITMMST)
 ORDER BY UNITPRICE DESC;

-- Q15. Orders with more than 3 lines, using the view.            (VIEW)
-- Expect 1 row: 10002 SHARMA TRADERS 27900.00, LINECNT 4
SELECT ORDNO, CUSTNAME, TOTAMT, LINECNT
  FROM COM022LIB.ORDSUMV
 WHERE LINECNT > 3;
