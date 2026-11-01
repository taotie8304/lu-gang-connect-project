package com.airscend.lugang.download

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BlobBudgetTest {

    @Test
    fun `声明的合法大小`() {
        assertTrue(BlobBudget(0).isDeclaredSizeValid())
        assertTrue(BlobBudget(BlobBudget.MAX_BYTES).isDeclaredSizeValid())
        assertFalse(BlobBudget(-1).isDeclaredSizeValid())
        assertFalse(BlobBudget(BlobBudget.MAX_BYTES + 1).isDeclaredSizeValid())
    }

    @Test
    fun `分块累加不得超出声明大小`() {
        val budget = BlobBudget(10)
        assertTrue(budget.accept(4))
        assertTrue(budget.accept(6))
        assertFalse(budget.accept(1))
        assertTrue(budget.isComplete())
    }

    @Test
    fun `未收满不算完成`() {
        val budget = BlobBudget(10)
        assertTrue(budget.accept(9))
        assertFalse(budget.isComplete())
    }

    @Test
    fun `负数分块被拒绝`() {
        val budget = BlobBudget(10)
        assertFalse(budget.accept(-1))
        assertFalse(budget.isComplete())
    }
}
