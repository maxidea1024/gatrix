// GatrixFlagSortingOrder - Control Renderer Sorting Layer and Order via feature flags
// Useful for layering A/B UI elements, controlling draw order dynamically

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a Renderer's sorting layer and order in layer based on a feature flag.
    /// Variant names map to specific sorting orders.
    /// </summary>
    [AddComponentMenu("Gatrix/2D/Flag Sorting Order")]
    public class GatrixFlagSortingOrder : GatrixFlagComponentBase
    {
        public enum SortingControlMode
        {
            OrderInLayer,
            SortingLayerName
        }

        [Header("Sorting Control")]
        [SerializeField] private SortingControlMode _mode = SortingControlMode.OrderInLayer;

        [Header("Order In Layer")]
        [Tooltip("Order when flag is enabled and no variant matches")]
        [SerializeField] private int _enabledOrder = 0;
        [Tooltip("Order when flag is disabled")]
        [SerializeField] private int _disabledOrder = 0;
        [SerializeField] private List<VariantInt> _orderMap = new List<VariantInt>();

        [Header("Sorting Layer Name")]
        [SerializeField] private string _enabledLayer = "Default";
        [SerializeField] private string _disabledLayer = "Default";
        [SerializeField] private List<VariantString> _layerMap = new List<VariantString>();

        [Header("Target (auto-detected)")]
        [SerializeField] private Renderer _renderer;

        [System.Serializable] public class VariantInt { public string VariantName; public int Order; }
        [System.Serializable] public class VariantString { public string VariantName; public string LayerName = "Default"; }

        private void Awake()
        {
            if (_renderer == null) _renderer = GetComponent<Renderer>();
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _renderer == null) return;

            switch (_mode)
            {
                case SortingControlMode.OrderInLayer:
                    _renderer.sortingOrder = ResolveOrder(flag);
                    break;

                case SortingControlMode.SortingLayerName:
                    _renderer.sortingLayerName = ResolveLayer(flag);
                    break;
            }
        }

        private int ResolveOrder(FlagProxy flag)
        {
            if (!flag.Enabled) return _disabledOrder;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _orderMap)
                if (e.VariantName == name) return e.Order;
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToInt32(flag.Variant.Value); } catch { }
            }
            return _enabledOrder;
        }

        private string ResolveLayer(FlagProxy flag)
        {
            if (!flag.Enabled) return _disabledLayer;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _layerMap)
                if (e.VariantName == name) return e.LayerName;
            if (flag.Variant?.Value is string str) return str;
            return _enabledLayer;
        }
    }
}
