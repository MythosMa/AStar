# A*算法的简单demo


## A*算法总结

1. 从起点开始，遍历得到起点周围点，排除掉障碍物后，将剩余的点放入openList中，即待验证计算的点的合集 并将它们的父节点设为起点，同时计算每个点的路径估值
   F = G + H
   其中，G为从起点开始到目标点所需要的步数，H为目标点到终点所需要的步数（无视障碍物，作出直接的估算，即Manhattan算法），F即通过该点到终点所需要的距离
2. 将起点放入closeList中，closeList即为经过验证计算的点的合集，其中的点后续无需再重新验证计算。
3. 遍历openList，取出F值最小的点设为新的验证计算的点，并将其放入closeList中。
4. 查找新的验证计算的点周围的点，排除障碍物后
   - 4-1 若周围的点不存在于openList中，将它们加入openList中，并将当前验证计算的点设为这些点的父节点。
   - 4-2 若周围的点已经存在于openList中，判断此点的原先的G值，是否大于通过验证计算的点到达此点的G值。如果大于，则证明通过验证计算的点到此点所用的距离G，要比原本此点的G要少，则
         通过验证计算的点到达此点路径更短。则将此点的父节点设为当前验证计算的点，并更新G和F（因为更新了到达此点的路径）。
   - 4-3 如果不大于，则不做任何操作。
5. 从第三步重复做起，直到终点也加入到openList中，证明终点已经到了验证计算的点的周围了。
6. 从终点开始，拿到终点的父节点，即父节点就是终点的前一步，再取父节点的父节点，即父节点的前一步。直到没有父节点为止，此时所有的父节点就是计算得到的路径。
7. 若没有找到路径，且openList变为空了，证明验证了所有的节点也没找到终点，证明没有路径。


- 使用 cocos creator 2.4.3