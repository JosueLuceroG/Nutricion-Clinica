import leafLeftUrl from "../../assets/brand/nutri-leaf-left.svg";
import leafRightUrl from "../../assets/brand/nutri-leaf-right.svg";
import "./NutriLogoLoader.css";

type NutriLogoLoaderProps = {
  text?: string;
  fullscreen?: boolean;
  className?: string;
  showProgress?: boolean;
};

export function NutriLogoLoader({
  text = "Cargando sistema...",
  fullscreen = true,
  className = "",
  showProgress = true,
}: NutriLogoLoaderProps) {
  return (
    <div
      className={[
        "nutri-loader",
        fullscreen ? "nutri-loader--fullscreen" : "nutri-loader--inline",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
      aria-label={text}
    >
      <div className="nutri-loader__card">
        <div className="nutri-loader__logoWrap" aria-hidden="true">
          <span className="nutri-loader__glow" />

          <img
            src={leafLeftUrl}
            alt=""
            className="nutri-loader__leaf nutri-loader__leaf--left"
            draggable={false}
          />

          <img
            src={leafRightUrl}
            alt=""
            className="nutri-loader__leaf nutri-loader__leaf--right"
            draggable={false}
          />
        </div>

        <p className="nutri-loader__text">{text}</p>

        <div className="nutri-loader__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        {showProgress && (
          <div className="nutri-loader__progress" aria-hidden="true">
            <span />
          </div>
        )}
      </div>
    </div>
  );
}
